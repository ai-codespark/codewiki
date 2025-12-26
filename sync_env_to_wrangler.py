#!/usr/bin/env python3
"""
Sync environment variables from .env.local to wrangler.toml files.

This script reads environment variables from .env.local and updates
both the frontend (root) and backend (api/) wrangler.toml files.

Usage:
    python sync_env_to_wrangler.py [options]

Options:
    --frontend-only     Only update frontend wrangler.toml
    --backend-only      Only update backend wrangler.toml
    --all-vars          Sync ALL variables (including secrets) to [vars] section
    --include-secrets   Add [secrets] section with all secret variables (commented)
    --help              Show this help message
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set


# Environment variables that should be treated as secrets (not added to vars section)
# Note: LITELLM_BASE_URL and LITELLM_API_KEY are NOT in this list, so they will be synced to [vars] section.
# If you prefer to keep LITELLM_API_KEY as a secret for better security, add it back to this list
# and set it using 'wrangler secret put LITELLM_API_KEY' instead.
SECRET_KEYS = {
    'GOOGLE_API_KEY',
    'OPENAI_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'OPENROUTER_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
}

# Environment variables that should not be synced
IGNORE_KEYS = {
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'PWD',
}


def parse_env_file(env_file_path: Path) -> Dict[str, str]:
    """Parse .env file and return key-value pairs."""
    env_vars = {}

    if not env_file_path.exists():
        print(f"Warning: {env_file_path} not found")
        return env_vars

    with open(env_file_path, 'r') as f:
        for line in f:
            line = line.strip()

            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue

            # Parse KEY=VALUE
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()

                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]

                # Skip ignored keys
                if key not in IGNORE_KEYS:
                    env_vars[key] = value

    return env_vars


def get_public_vars(env_vars: Dict[str, str]) -> Dict[str, str]:
    """Filter out secret keys to get public environment variables."""
    return {k: v for k, v in env_vars.items() if k not in SECRET_KEYS}


def get_secret_keys(env_vars: Dict[str, str]) -> Set[str]:
    """Get list of secret keys that need to be set via wrangler secret."""
    return {k for k in env_vars.keys() if k in SECRET_KEYS}


def get_secret_vars(env_vars: Dict[str, str]) -> Dict[str, str]:
    """Get secret environment variables."""
    return {k: v for k, v in env_vars.items() if k in SECRET_KEYS}


def update_wrangler_toml(wrangler_path: Path, env_vars: Dict[str, str],
                         include_all: bool = False, include_secrets_section: bool = False) -> bool:
    """Update wrangler.toml with environment variables.

    Args:
        wrangler_path: Path to wrangler.toml file
        env_vars: Dictionary of environment variables
        include_all: If True, sync all variables to [vars] section
        include_secrets_section: If True, add [secrets] section with commented secrets
    """
    if not wrangler_path.exists():
        print(f"Warning: {wrangler_path} not found")
        return False

    with open(wrangler_path, 'r') as f:
        content = f.read()

    # Determine which vars to sync
    if include_all:
        vars_to_sync = env_vars  # Include everything
    else:
        vars_to_sync = get_public_vars(env_vars)  # Only public vars

    # Build new [vars] section
    vars_section_lines = ["[vars]"]

    # Preserve certain default variables from the existing file
    preserve_vars = ['NODE_VERSION', 'NODE_ENV', 'PORT']
    for var in preserve_vars:
        if var not in vars_to_sync:  # Only preserve if not in env_vars
            match = re.search(rf'{var}\s*=\s*"([^"]+)"', content)
            if match:
                vars_section_lines.append(f'{var} = "{match.group(1)}"')

    # Add environment variables (sorted for consistency)
    for key, value in sorted(vars_to_sync.items()):
        # Escape quotes in value
        escaped_value = value.replace('"', '\\"')
        vars_section_lines.append(f'{key} = "{escaped_value}"')

    new_vars_section = '\n'.join(vars_section_lines)

    # Build secrets section if requested
    new_secrets_section = ""
    if include_secrets_section:
        secret_vars = get_secret_vars(env_vars)
        if secret_vars:
            secrets_lines = ["\n[secrets]"]
            secrets_lines.append("# Secret values - set these using: wrangler secret put KEY")
            for key, value in sorted(secret_vars.items()):
                secrets_lines.append(f"# {key} = \"PLACEHOLDER\"")
            new_secrets_section = '\n'.join(secrets_lines)

    # Replace existing [vars] section
    # Match [vars] section until the next section or end of file
    vars_pattern = r'\[vars\][\s\S]*?(?=\n\[|\Z)'

    # Replace existing sections
    if '[vars]' in content:
        new_content = re.sub(vars_pattern, new_vars_section, content)
    else:
        new_content = content.rstrip() + '\n\n' + new_vars_section + '\n'

    # Replace or add [secrets] section if needed
    if include_secrets_section and new_secrets_section:
        secrets_pattern = r'\[secrets\][\s\S]*?(?=\n\[|\Z)'
        if '[secrets]' in new_content:
            new_content = re.sub(secrets_pattern, new_secrets_section.lstrip('\n'), new_content)
        else:
            new_content = new_content.rstrip() + new_secrets_section + '\n'

    # Write updated content
    with open(wrangler_path, 'w') as f:
        f.write(new_content)

    print(f"✓ Updated {wrangler_path}")
    return True


def print_secret_instructions(secret_keys: Set[str], target: str):
    """Print instructions for setting secrets via wrangler CLI."""
    if not secret_keys:
        return

    print(f"\n📝 Secret keys detected for {target}. Set them using wrangler CLI:")
    print(f"   (Note: Secrets are encrypted and not stored in wrangler.toml)\n")

    for key in sorted(secret_keys):
        print(f"   wrangler secret put {key}")

    print()


def main():
    """Main function."""
    # Parse command line arguments
    frontend_only = '--frontend-only' in sys.argv
    backend_only = '--backend-only' in sys.argv
    include_all = '--all-vars' in sys.argv
    include_secrets_section = '--include-secrets' in sys.argv
    show_help = '--help' in sys.argv

    if show_help:
        print(__doc__)
        return

    # Get paths
    root_dir = Path(__file__).parent
    env_file = root_dir / '.env.local'
    frontend_wrangler = root_dir / 'wrangler.toml'
    backend_wrangler = root_dir / 'api' / 'wrangler.toml'

    # Parse .env.local
    print(f"Reading environment variables from {env_file}...")
    env_vars = parse_env_file(env_file)

    if not env_vars:
        print("No environment variables found in .env.local")
        return

    print(f"Found {len(env_vars)} environment variables")

    # Get secret keys
    secret_keys = get_secret_keys(env_vars)
    public_count = len(env_vars) - len(secret_keys)

    # Display mode information
    if include_all:
        print("  📌 Mode: ALL VARIABLES (including secrets)")
        print(f"  - {len(env_vars)} variables will be synced to [vars]")
    else:
        print(f"  - {public_count} public variables (will be added to [vars])")
        print(f"  - {len(secret_keys)} secret variables (need to be set via CLI)")

    if include_secrets_section:
        print("  - [secrets] section with comments will be added for reference")

    print()

    # Update frontend wrangler.toml
    if not backend_only:
        if update_wrangler_toml(frontend_wrangler, env_vars, include_all, include_secrets_section):
            if not include_all:
                print_secret_instructions(secret_keys, "frontend")

    # Update backend wrangler.toml
    if not frontend_only:
        if update_wrangler_toml(backend_wrangler, env_vars, include_all, include_secrets_section):
            if not include_all:
                print_secret_instructions(secret_keys, "backend (api/)")

    print("✅ Environment sync complete!")
    print("\nUsage options:")
    print("  python sync_env_to_wrangler.py                    # Sync public vars only")
    print("  python sync_env_to_wrangler.py --all-vars         # Sync ALL variables")
    print("  python sync_env_to_wrangler.py --include-secrets  # Add [secrets] section (commented)")
    print("  python sync_env_to_wrangler.py --frontend-only    # Frontend only")
    print("  python sync_env_to_wrangler.py --backend-only     # Backend only")
    print("  python sync_env_to_wrangler.py --help             # Show help")


if __name__ == '__main__':
    main()
