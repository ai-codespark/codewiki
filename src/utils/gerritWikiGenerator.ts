import { GerritWikiData, GerritChange } from '@/types/gerrit';

export class GerritWikiGenerator {
  private data: GerritWikiData;

  constructor(data: GerritWikiData) {
    this.data = data;
  }

  // 生成主wiki文档
  generateWikiDocument(): string {
    const { project, branches, statistics } = this.data;

    const sections = [
      this.generateHeader(),
      this.generateProjectOverview(),
      this.generateStatistics(),
      this.generateBranches(),
      this.generateRecentChanges(),
      this.generateChangeDetails(),
      this.generateFooter(),
    ];

    return sections.join('\n\n');
  }

  // 生成文档头部
  private generateHeader(): string {
    const { project } = this.data;
    return `# ${project.name}\n\n*Generated from Gerrit on ${new Date().toISOString()}*`;
  }

  // 生成项目概览
  private generateProjectOverview(): string {
    const { project } = this.data;

    return `## 项目概览\n\n${project.description || '暂无描述'}\n\n- **状态**: ${project.state}\n- **父项目**: ${project.parent}`;
  }

  // 生成统计信息
  private generateStatistics(): string {
    const { statistics } = this.data;

    return `## 统计信息\n\n| 指标 | 数量 |\n|------|------|\n| 总变更数 | ${statistics.totalChanges} |\n| 已合并 | ${statistics.mergedChanges} |\n| 开放中 | ${statistics.openChanges} |\n| 已放弃 | ${statistics.abandonedChanges} |\n| 最后活动 | ${new Date(statistics.lastActivity).toLocaleString('zh-CN')} |`;
  }

  // 生成分支信息
  private generateBranches(): string {
    const { branches } = this.data;

    if (branches.length === 0) {
      return `## 分支信息\n\n暂无分支信息`;
    }

    const branchTable = branches.map(branch =>
      `| ${branch.ref} | ${branch.revision.substring(0, 8)} |`
    ).join('\n');

    return `## 分支信息\n\n| 分支 | 最新提交 |\n|------|----------|\n${branchTable}`;
  }

  // 生成最近变更概览
  private generateRecentChanges(): string {
    const { changes } = this.data;

    if (changes.length === 0) {
      return `## 最近变更\n\n暂无变更记录`;
    }

    // 按状态分组
    const changesByStatus = this.groupChangesByStatus(changes);

    let content = `## 最近变更\n\n`;

    Object.entries(changesByStatus).forEach(([status, statusChanges]) => {
      if (statusChanges.length > 0) {
        content += `### ${this.getStatusLabel(status)} (${statusChanges.length})\n\n`;

        const recentChanges = statusChanges.slice(0, 10); // 显示最近10个
        const changeList = recentChanges.map(change =>
          `- **${change.subject}** (ID: ${change.change_id})\n  - 作者: ${change.owner.name} <${change.owner.email}>\n  - 创建时间: ${new Date(change.created).toLocaleString('zh-CN')}\n  - 分支: ${change.branch}`
        ).join('\n\n');

        content += `${changeList}\n\n`;
      }
    });

    return content;
  }

  // 生成变更详情表格
  private generateChangeDetails(): string {
    const { changes } = this.data;

    if (changes.length === 0) {
      return '';
    }

    // 只显示最近的20个变更
    const recentChanges = changes.slice(0, 20);

    const changeRows = recentChanges.map(change => {
      const labels = this.formatLabels(change.labels);
      return `| ${change.subject} | ${change.branch} | ${this.getStatusLabel(change.status)} | ${change.owner.name} | ${new Date(change.created).toLocaleDateString('zh-CN')} | ${labels} |`;
    }).join('\n');

    return `## 变更详情\n\n| 标题 | 分支 | 状态 | 作者 | 创建日期 | 标签 |\n|------|------|------|------|----------|------|\n${changeRows}`;
  }

  // 生成文档尾部
  private generateFooter(): string {
    return `---\n\n*此文档由 Gerrit Wiki 生成器自动创建* | *最后更新: ${new Date().toLocaleString('zh-CN')}* | *数据源: Gerrit Code Review* |`;
  }

  // 按状态分组变更
  private groupChangesByStatus(changes: GerritChange[]): Record<string, GerritChange[]> {
    return changes.reduce((groups, change) => {
      if (!groups[change.status]) {
        groups[change.status] = [];
      }
      groups[change.status].push(change);
      return groups;
    }, {} as Record<string, GerritChange[]>);
  }

  // 获取状态标签
  private getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      'NEW': '🔵 开放中',
      'MERGED': '🟢 已合并',
      'ABANDONED': '🔴 已放弃',
    };
    return statusMap[status] || status;
  }

  // 格式化标签
  private formatLabels(labels?: Record<string, any>): string {
    if (!labels) return '-';

    const formattedLabels = Object.entries(labels)
      .filter(([key, value]) => key !== 'Code-Review' || value?.approved?._account_id)
      .map(([key, value]) => {
        if (value?.approved) {
          return `✅ ${key}`;
        } else if (value?.rejected) {
          return `❌ ${key}`;
        } else {
          return `⏳ ${key}`;
        }
      });

    return formattedLabels.length > 0 ? formattedLabels.join(', ') : '-';
  }

  // 生成Mermaid流程图
  generateMermaidDiagram(): string {
    const { changes, statistics } = this.data;

    return `\n## 开发流程图\n\n\`\`\`mermaid
graph TD
    A[代码开发] --> B[创建变更]
    B --> C{代码审查}
    C -->|通过| D[合并到主分支]
    C -->|需要修改| E[更新变更]
    E --> C
    C -->|放弃| F[关闭变更]

    style A fill:#e1f5fe
    style D fill:#c8e6c9
    style F fill:#ffcdd2
\`\`\`\n\n### 当前状态统计\n- 🔵 开放中的变更: ${statistics.openChanges}\n- 🟢 已合并的变更: ${statistics.mergedChanges}\n- 🔴 已放弃的变更: ${statistics.abandonedChanges}`;
  }

  // 生成完整的wiki文档（包含图表）
  generateCompleteWiki(): string {
    const mainDoc = this.generateWikiDocument();
    const mermaidDiagram = this.generateMermaidDiagram();

    return `${mainDoc}\n${mermaidDiagram}`;
  }

  // 生成Markdown格式的变更日志
  generateChangelog(): string {
    const { changes } = this.data;

    if (changes.length === 0) {
      return '# 变更日志\n\n暂无变更记录';
    }

    const changelog = changes
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      .map(change => {
        const date = new Date(change.created).toLocaleDateString('zh-CN');
        return `## ${change.subject}\n\n**日期**: ${date}\n**作者**: ${change.owner.name} <${change.owner.email}>\n**状态**: ${this.getStatusLabel(change.status)}\n**分支**: ${change.branch}\n**变更ID**: ${change.change_id}\n`;
      })
      .join('\n---\n');

    return `# 变更日志\n\n${changelog}`;
  }
}

// 生成器工厂函数
export function createGerritWikiGenerator(data: GerritWikiData): GerritWikiGenerator {
  return new GerritWikiGenerator(data);
}