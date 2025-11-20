import { GerritConfig, GerritProject, GerritChange, GerritWikiData } from '@/types/gerrit';

export class GerritClient {
  private config: GerritConfig;

  constructor(config: GerritConfig) {
    this.config = config;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.config.baseUrl}/a${endpoint}`;
    const headers = new Headers({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    });

    // 添加基本认证
    const auth = btoa(`${this.config.username}:${this.config.password}`);
    headers.set('Authorization', `Basic ${auth}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Gerrit API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      // Gerrit API返回的数据通常以")]}'"开头，需要移除
      const cleanedText = text.replace(/^\)]}'/, '');
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error(`Gerrit API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // 获取所有项目
  async getProjects(): Promise<Record<string, GerritProject>> {
    return this.makeRequest<Record<string, GerritProject>>('/projects/?d');
  }

  // 获取单个项目详情
  async getProject(projectName: string): Promise<GerritProject> {
    const encodedProjectName = encodeURIComponent(projectName);
    return this.makeRequest<GerritProject>(`/projects/${encodedProjectName}`);
  }

  // 获取项目的分支
  async getProjectBranches(projectName: string): Promise<Record<string, unknown>> {
    const encodedProjectName = encodeURIComponent(projectName);
    return this.makeRequest<Record<string, unknown>>(`/projects/${encodedProjectName}/branches`);
  }

  // 获取变更列表
  async getChanges(query: string = 'status:open'): Promise<GerritChange[]> {
    const encodedQuery = encodeURIComponent(query);
    return this.makeRequest<GerritChange[]>(`/changes/?q=${encodedQuery}`);
  }

  // 获取项目特定的变更
  async getProjectChanges(projectName: string, query: string = 'status:open'): Promise<GerritChange[]> {
    const projectQuery = `project:${projectName}+${query}`;
    return this.getChanges(projectQuery);
  }

  // 获取变更详情
  async getChangeDetail(changeId: string): Promise<GerritChange> {
    const encodedChangeId = encodeURIComponent(changeId);
    return this.makeRequest<GerritChange>(`/changes/${encodedChangeId}/detail`);
  }

  // 获取完整的wiki数据
  async getWikiData(projectName: string): Promise<GerritWikiData> {
    try {
      // 并行获取项目信息、分支和变更
      const [project, branches, openChanges, mergedChanges] = await Promise.all([
        this.getProject(projectName),
        this.getProjectBranches(projectName),
        this.getProjectChanges(projectName, 'status:open'),
        this.getProjectChanges(projectName, 'status:merged limit:20'),
      ]);

      const allChanges = [...openChanges, ...mergedChanges];

      // 计算统计信息
      const statistics = {
        totalChanges: allChanges.length,
        mergedChanges: mergedChanges.length,
        openChanges: openChanges.length,
        abandonedChanges: 0, // 可以添加获取已放弃变更的逻辑
        lastActivity: allChanges.length > 0
          ? allChanges[0].updated
          : new Date().toISOString(),
      };

      // 格式化分支数据
      const formattedBranches = Object.entries(branches).map(([ref, branchData]) => ({
        ref,
        revision: (branchData as { revision?: string }).revision || '',
      }));

      return {
        project,
        changes: allChanges,
        branches: formattedBranches,
        statistics,
      };
    } catch (error) {
      console.error(`Failed to get wiki data for project ${projectName}:`, error);
      throw new Error(`Failed to fetch Gerrit project data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      await this.getProjects();
      return true;
    } catch (error) {
      console.error('Gerrit connection test failed:', error);
      return false;
    }
  }
}

// Gerrit客户端工厂函数
export function createGerritClient(config: GerritConfig): GerritClient {
  return new GerritClient(config);
}