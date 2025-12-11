'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// Define the interfaces for our model configuration
interface Model {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  models: Model[];
  supportsCustomModel?: boolean;
}

interface ModelConfig {
  providers: Provider[];
  defaultProvider: string;
}

interface ModelSelectorProps {
  provider: string;
  setProvider: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  isCustomModel: boolean;
  setIsCustomModel: (value: boolean) => void;
  customModel: string;
  setCustomModel: (value: string) => void;

  // File filter configuration
  showFileFilters?: boolean;
  excludedDirs?: string;
  setExcludedDirs?: (value: string) => void;
  excludedFiles?: string;
  setExcludedFiles?: (value: string) => void;
  includedDirs?: string;
  setIncludedDirs?: (value: string) => void;
  includedFiles?: string;
  setIncludedFiles?: (value: string) => void;

  // LiteLLM provider-specific settings
  litellmApiKey?: string;
  setLitellmApiKey?: (value: string) => void;
  litellmBaseUrl?: string;
  setLitellmBaseUrl?: (value: string) => void;
}

export default function UserSelector({
  provider,
  setProvider,
  model,
  setModel,
  isCustomModel,
  setIsCustomModel,
  customModel,
  setCustomModel,

  // File filter configuration
  showFileFilters = false,
  excludedDirs = '',
  setExcludedDirs,
  excludedFiles = '',
  setExcludedFiles,
  includedDirs = '',
  setIncludedDirs,
  includedFiles = '',
  setIncludedFiles,

  // LiteLLM provider-specific settings
  litellmApiKey = '',
  setLitellmApiKey,
  litellmBaseUrl = '',
  setLitellmBaseUrl
}: ModelSelectorProps) {
  // Create local state for LiteLLM if setters are not provided
  const [localLitellmApiKey, setLocalLitellmApiKey] = useState(litellmApiKey);
  const [localLitellmBaseUrl, setLocalLitellmBaseUrl] = useState(litellmBaseUrl);

  // Use provided setters or local state setters
  const effectiveSetLitellmApiKey = setLitellmApiKey || setLocalLitellmApiKey;
  const effectiveSetLitellmBaseUrl = setLitellmBaseUrl || setLocalLitellmBaseUrl;
  const effectiveLitellmApiKey = setLitellmApiKey ? litellmApiKey : localLitellmApiKey;
  const effectiveLitellmBaseUrl = setLitellmBaseUrl ? litellmBaseUrl : localLitellmBaseUrl;

  // Sync local state when props change (only if using local state)
  useEffect(() => {
    if (!setLitellmApiKey) {
      setLocalLitellmApiKey(litellmApiKey);
    }
  }, [litellmApiKey, setLitellmApiKey]);

  useEffect(() => {
    if (!setLitellmBaseUrl) {
      setLocalLitellmBaseUrl(litellmBaseUrl);
    }
  }, [litellmBaseUrl, setLitellmBaseUrl]);
  // State to manage the visibility of the filters modal and filter section
  const [isFilterSectionOpen, setIsFilterSectionOpen] = useState(false);
  // State to manage filter mode: 'exclude' or 'include'
  const [filterMode, setFilterMode] = useState<'exclude' | 'include'>('exclude');

  // State for LiteLLM connection test
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { messages: t } = useLanguage();

  // State for model configurations from backend
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for viewing default values
  const [showDefaultDirs, setShowDefaultDirs] = useState(false);
  const [showDefaultFiles, setShowDefaultFiles] = useState(false);

  // Fetch model configurations from the backend
  useEffect(() => {
    const fetchModelConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/models/config');

        if (!response.ok) {
          throw new Error(`Error fetching model configurations: ${response.status}`);
        }

        const data = await response.json();
        setModelConfig(data);

        // Initialize provider and model with defaults from API if not already set
        if (!provider && data.defaultProvider) {
          setProvider(data.defaultProvider);

          // Find the default provider and set its default model
          const selectedProvider = data.providers.find((p: Provider) => p.id === data.defaultProvider);
          if (selectedProvider && selectedProvider.models.length > 0) {
            setModel(selectedProvider.models[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch model configurations:', err);
        setError('Failed to load model configurations. Using default options.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelConfig();
  }, [provider, setModel, setProvider]);

  // Handler for changing provider
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setTimeout(() => {
      // Reset custom model state when changing providers
      setIsCustomModel(false);

      // Set default model for the selected provider
      if (modelConfig) {
        const selectedProvider = modelConfig.providers.find((p: Provider) => p.id === newProvider);
        if (selectedProvider && selectedProvider.models.length > 0) {
          setModel(selectedProvider.models[0].id);
        }
      }
    }, 10);
  };

  // Default excluded directories from config.py
  const defaultExcludedDirs =
`./.venv/
./venv/
./env/
./virtualenv/
./node_modules/
./bower_components/
./jspm_packages/
./.git/
./.svn/
./.hg/
./.bzr/
./__pycache__/
./.pytest_cache/
./.mypy_cache/
./.ruff_cache/
./.coverage/
./dist/
./build/
./out/
./target/
./bin/
./obj/
./docs/
./_docs/
./site-docs/
./_site/
./.idea/
./.vscode/
./.vs/
./.eclipse/
./.settings/
./logs/
./log/
./tmp/
./temp/
./.eng`;

  // Default excluded files from config.py
  const defaultExcludedFiles =
`package-lock.json
yarn.lock
pnpm-lock.yaml
npm-shrinkwrap.json
poetry.lock
Pipfile.lock
requirements.txt.lock
Cargo.lock
composer.lock
.lock
.DS_Store
Thumbs.db
desktop.ini
*.lnk
.env
.env.*
*.env
*.cfg
*.ini
.flaskenv
.gitignore
.gitattributes
.gitmodules
.github
.gitlab-ci.yml
.prettierrc
.eslintrc
.eslintignore
.stylelintrc
.editorconfig
.jshintrc
.pylintrc
.flake8
mypy.ini
pyproject.toml
tsconfig.json
webpack.config.js
babel.config.js
rollup.config.js
jest.config.js
karma.conf.js
vite.config.js
next.config.js
*.min.js
*.min.css
*.bundle.js
*.bundle.css
*.map
*.gz
*.zip
*.tar
*.tgz
*.rar
*.pyc
*.pyo
*.pyd
*.so
*.dll
*.class
*.exe
*.o
*.a
*.jpg
*.jpeg
*.png
*.gif
*.ico
*.svg
*.webp
*.mp3
*.mp4
*.wav
*.avi
*.mov
*.webm
*.csv
*.tsv
*.xls
*.xlsx
*.db
*.sqlite
*.sqlite3
*.pdf
*.docx
*.pptx`;

  // Display loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-[var(--muted)]">Loading model configurations...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 mb-2">{error}</div>
        )}

        {/* Provider Selection */}
        <div>
          <label htmlFor="provider-dropdown" className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
            {t.form?.modelProvider || 'Model Provider'}
          </label>
          <select
            id="provider-dropdown"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="input-japanese block w-full px-2.5 py-1.5 text-sm rounded-md bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="" disabled>{t.form?.selectProvider || 'Select Provider'}</option>
            {modelConfig?.providers.map((providerOption) => {
              // Handle special case for LiteLLM capitalization
              let providerKey = providerOption.id.charAt(0).toUpperCase() + providerOption.id.slice(1);
              if (providerOption.id === "litellm") {
                providerKey = "LiteLLM";
              }
              return (
                <option key={providerOption.id} value={providerOption.id}>
                  {t.form?.[`provider${providerKey}`] || providerOption.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Model Selection - consistent height regardless of type */}
        <div>
          <label htmlFor={isCustomModel ? "custom-model-input" : "model-dropdown"} className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
            {t.form?.modelSelection || 'Model Selection'}
          </label>

          {isCustomModel ? (
            <input
              id="custom-model-input"
              type="text"
              value={customModel}
              onChange={(e) => {
                setCustomModel(e.target.value);
                setModel(e.target.value);
              }}
              placeholder={t.form?.customModelPlaceholder || 'Enter custom model name'}
              className="input-japanese block w-full px-2.5 py-1.5 text-sm rounded-md bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          ) : (
            <select
              id="model-dropdown"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input-japanese block w-full px-2.5 py-1.5 text-sm rounded-md bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-primary)]"
              disabled={!provider || isLoading || !modelConfig?.providers.find(p => p.id === provider)?.models?.length}
            >
              {modelConfig?.providers.find((p: Provider) => p.id === provider)?.models.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name}
                </option>
              )) || <option value="">{t.form?.selectModel || 'Select Model'}</option>}
            </select>
          )}
        </div>

        {/* Custom model toggle - only when provider supports it */}
        {modelConfig?.providers.find((p: Provider) => p.id === provider)?.supportsCustomModel && (
          <div className="mb-2">
            <div className="flex items-center pb-1">
              <div
                className="relative flex items-center cursor-pointer"
                onClick={() => {
                  const newValue = !isCustomModel;
                  setIsCustomModel(newValue);
                  if (newValue) {
                    setCustomModel(model);
                  }
                }}
              >
                <input
                  id="use-custom-model"
                  type="checkbox"
                  checked={isCustomModel}
                  onChange={() => {}}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${isCustomModel ? 'bg-[var(--accent-primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform transform ${isCustomModel ? 'translate-x-5' : ''}`}></div>
              </div>
              <label
                htmlFor="use-custom-model"
                className="ml-2 text-sm font-medium text-[var(--muted)] cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  const newValue = !isCustomModel;
                  setIsCustomModel(newValue);
                  if (newValue) {
                    setCustomModel(model);
                  }
                }}
              >
                {t.form?.useCustomModel || 'Use custom model'}
              </label>
            </div>
          </div>
        )}

        {/* LiteLLM provider-specific settings - always show when provider is litellm */}
        {provider === "litellm" && (
          <div className="space-y-3 mt-3 p-3 border border-[var(--border-color)]/70 rounded-md bg-[var(--background)]/30">
            <div>
              <label htmlFor="litellm-api-key" className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                LiteLLM API Key
              </label>
              <input
                id="litellm-api-key"
                type="password"
                value={effectiveLitellmApiKey ?? ''}
                onChange={(e) => {
                  effectiveSetLitellmApiKey(e.target.value);
                  setConnectionTestResult(null); // Clear test result when input changes
                }}
                className="input-japanese block w-full px-2.5 py-1.5 text-sm rounded-md bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label htmlFor="litellm-base-url" className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                LiteLLM Base URL
              </label>
              <input
                id="litellm-base-url"
                type="text"
                value={effectiveLitellmBaseUrl ?? ''}
                onChange={(e) => {
                  effectiveSetLitellmBaseUrl(e.target.value);
                  setConnectionTestResult(null); // Clear test result when input changes
                }}
                className="input-japanese block w-full px-2.5 py-1.5 text-sm rounded-md bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            {/* Test Connection Button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  setIsTestingConnection(true);
                  setConnectionTestResult(null);

                  try {
                    const response = await fetch('/api/litellm/test-connection', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        api_key: effectiveLitellmApiKey || undefined,
                        base_url: effectiveLitellmBaseUrl || undefined,
                      }),
                    });

                    const result = await response.json();
                    setConnectionTestResult(result);
                  } catch (error) {
                    setConnectionTestResult({
                      success: false,
                      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                  } finally {
                    setIsTestingConnection(false);
                  }
                }}
                disabled={isTestingConnection || !effectiveLitellmApiKey || !effectiveLitellmBaseUrl}
                className="w-full px-3 py-2 text-sm font-medium rounded-md border border-[var(--border-color)]/50 text-[var(--foreground)] bg-transparent hover:bg-[var(--background)] hover:border-[var(--accent-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>

              {/* Connection Test Result */}
              {connectionTestResult && (
                <div className={`mt-2 p-2 rounded-md text-xs ${
                  connectionTestResult.success
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                }`}>
                  {connectionTestResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {showFileFilters && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFilterSectionOpen(!isFilterSectionOpen)}
              className="flex items-center text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
            >
              <span className="mr-1.5 text-xs">{isFilterSectionOpen ? '▼' : '►'}</span>
              {t.form?.advancedOptions || 'Advanced Options'}
            </button>

            {isFilterSectionOpen && (
              <div className="mt-3 p-3 border border-[var(--border-color)]/70 rounded-md bg-[var(--background)]/30">
                {/* Filter Mode Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    {t.form?.filterMode || 'Filter Mode'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterMode('exclude')}
                      className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                        filterMode === 'exclude'
                          ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--background)]'
                      }`}
                    >
                      {t.form?.excludeMode || 'Exclude Paths'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('include')}
                      className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                        filterMode === 'include'
                          ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--background)]'
                      }`}
                    >
                      {t.form?.includeMode || 'Include Only Paths'}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {filterMode === 'exclude'
                      ? (t.form?.excludeModeDescription || 'Specify paths to exclude from processing (default behavior)')
                      : (t.form?.includeModeDescription || 'Specify only the paths to include, ignoring all others')
                    }
                  </p>
                </div>

                {/* Directories Section */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
                    {filterMode === 'exclude'
                      ? (t.form?.excludedDirs || 'Excluded Directories')
                      : (t.form?.includedDirs || 'Included Directories')
                    }
                  </label>
                  <textarea
                    value={filterMode === 'exclude' ? excludedDirs : includedDirs}
                    onChange={(e) => {
                      if (filterMode === 'exclude') {
                        setExcludedDirs?.(e.target.value);
                      } else {
                        setIncludedDirs?.(e.target.value);
                      }
                    }}
                    rows={4}
                    className="block w-full rounded-md border border-[var(--border-color)]/50 bg-[var(--input-bg)] text-[var(--foreground)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-opacity-50 shadow-sm"
                    placeholder={filterMode === 'exclude'
                      ? (t.form?.enterExcludedDirs || 'Enter excluded directories, one per line...')
                      : (t.form?.enterIncludedDirs || 'Enter included directories, one per line...')
                    }
                  />
                  {filterMode === 'exclude' && (
                    <>
                      <div className="flex mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowDefaultDirs(!showDefaultDirs)}
                          className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
                        >
                          {showDefaultDirs ? (t.form?.hideDefault || 'Hide Default') : (t.form?.viewDefault || 'View Default')}
                        </button>
                      </div>
                      {showDefaultDirs && (
                        <div className="mt-2 p-2 rounded bg-[var(--background)]/50 text-xs">
                          <p className="mb-1 text-[var(--muted)]">{t.form?.defaultNote || 'These defaults are already applied. Add your custom exclusions above.'}</p>
                          <pre className="whitespace-pre-wrap font-mono text-[var(--muted)] overflow-y-auto max-h-32">{defaultExcludedDirs}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Files Section */}
                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
                    {filterMode === 'exclude'
                      ? (t.form?.excludedFiles || 'Excluded Files')
                      : (t.form?.includedFiles || 'Included Files')
                    }
                  </label>
                  <textarea
                    value={filterMode === 'exclude' ? excludedFiles : includedFiles}
                    onChange={(e) => {
                      if (filterMode === 'exclude') {
                        setExcludedFiles?.(e.target.value);
                      } else {
                        setIncludedFiles?.(e.target.value);
                      }
                    }}
                    rows={4}
                    className="block w-full rounded-md border border-[var(--border-color)]/50 bg-[var(--input-bg)] text-[var(--foreground)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-opacity-50 shadow-sm"
                    placeholder={filterMode === 'exclude'
                      ? (t.form?.enterExcludedFiles || 'Enter excluded files, one per line...')
                      : (t.form?.enterIncludedFiles || 'Enter included files, one per line...')
                    }
                  />
                  {filterMode === 'exclude' && (
                    <>
                      <div className="flex mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowDefaultFiles(!showDefaultFiles)}
                          className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
                        >
                          {showDefaultFiles ? (t.form?.hideDefault || 'Hide Default') : (t.form?.viewDefault || 'View Default')}
                        </button>
                      </div>
                      {showDefaultFiles && (
                        <div className="mt-2 p-2 rounded bg-[var(--background)]/50 text-xs">
                          <p className="mb-1 text-[var(--muted)]">{t.form?.defaultNote || 'These defaults are already applied. Add your custom exclusions above.'}</p>
                          <pre className="whitespace-pre-wrap font-mono text-[var(--muted)] overflow-y-auto max-h-32">{defaultExcludedFiles}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
