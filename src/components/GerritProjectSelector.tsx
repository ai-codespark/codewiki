'use client';

import React, { useState, useEffect } from 'react';
import { GerritConfig, GerritProject } from '@/types/gerrit';
import { createGerritClient } from '@/utils/gerritClient';

interface GerritProjectSelectorProps {
  config: GerritConfig;
  onProjectSelect: (project: GerritProject) => void;
  onClose: () => void;
}

export default function GerritProjectSelector({ config, onProjectSelect, onClose }: GerritProjectSelectorProps) {
  const [projects, setProjects] = useState<GerritProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<GerritProject | null>(null);

  useEffect(() => {
    loadProjects();
  }, [config]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const client = createGerritClient(config);
      const projectsData = await client.getProjects();

      // 转换为数组并排序
      const projectsArray = Object.entries(projectsData)
        .map(([name, project]) => ({
          ...project,
          name, // 确保name字段存在
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setProjects(projectsArray);
    } catch (err) {
      console.error('Failed to load Gerrit projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleProjectSelect = (project: GerritProject) => {
    setSelectedProject(project);
    onProjectSelect(project);
    onClose();
  };

  const getStatusBadge = (state: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'ACTIVE': { color: 'bg-green-100 text-green-800', text: '活跃' },
      'READ_ONLY': { color: 'bg-yellow-100 text-yellow-800', text: '只读' },
      'HIDDEN': { color: 'bg-gray-100 text-gray-800', text: '隐藏' },
    };

    const status = statusMap[state] || { color: 'bg-gray-100 text-gray-800', text: state };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${status.color}`}>
        {status.text}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            选择 Gerrit 项目
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索项目名称或描述..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={loadProjects}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <div className="flex justify-between items-center">
              <span>加载项目失败：{error}</span>
              <button
                onClick={loadProjects}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                重试
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              正在加载项目列表...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? (
                <>
                  <p className="mb-2">没有找到匹配的项目</p>
                  <p className="text-sm">尝试调整搜索条件</p>
                </>
              ) : (
                <>
                  <p className="mb-2">没有找到项目</p>
                  <p className="text-sm">请检查Gerrit配置和权限</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedProject?.id === project.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  onClick={() => handleProjectSelect(project)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white text-lg">
                      {project.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(project.state)}
                      {project.parent !== 'All-Projects' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          父项目: {project.parent}
                        </span>
                      )}
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>ID: {project.id}</span>
                    {project.web_links && project.web_links.length > 0 && (
                      <div className="flex space-x-2">
                        {project.web_links.map((link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {link.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
            <span>
              共 {projects.length} 个项目
              {searchTerm && `，显示 ${filteredProjects.length} 个匹配项`}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}