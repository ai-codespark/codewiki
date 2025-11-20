'use client';

import React, { useState, useEffect } from 'react';
import { GerritProject, GerritWikiData } from '@/types/gerrit';
import { createGerritClient } from '@/utils/gerritClient';
import { createGerritWikiGenerator } from '@/utils/gerritWikiGenerator';
import GerritProjectSelector from './GerritProjectSelector';
import Markdown from './Markdown';
import { useNotification } from './Notification';

interface GerritWikiGeneratorIntegratedProps {
  gerritBaseUrl?: string;
  gerritUsername?: string;
  gerritToken?: string;
}

export default function GerritWikiGeneratorIntegrated({
  gerritBaseUrl,
  gerritUsername,
  gerritToken
}: GerritWikiGeneratorIntegratedProps) {
  const { showNotification, NotificationComponent } = useNotification();
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProject, setSelectedProject] = useState<GerritProject | null>(null);
  const [wikiData, setWikiData] = useState<GerritWikiData | null>(null);
  const [generatedWiki, setGeneratedWiki] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // 检查是否已配置Gerrit连接信息
    const configured = !!(gerritBaseUrl && gerritUsername && gerritToken);
    setIsConfigured(configured);
  }, [gerritBaseUrl, gerritUsername, gerritToken]);

  const handleProjectSelect = async (project: GerritProject) => {
    if (!isConfigured) {
      showNotification({
        type: 'error',
        title: '配置错误',
        message: '请先配置Gerrit连接信息',
        duration: 5000,
      });
      return;
    }

    if (!gerritBaseUrl || !gerritUsername || !gerritToken) {
      showNotification({
        type: 'error',
        title: '配置错误',
        message: 'Gerrit配置信息不完整',
        duration: 5000,
      });
      return;
    }

    setSelectedProject(project);
    setLoading(true);
    setError(null);

    try {
      // 创建Gerrit客户端
      const client = createGerritClient({
        id: `gerrit-${Date.now()}`,
        name: gerritBaseUrl,
        baseUrl: gerritBaseUrl,
        username: gerritUsername,
        password: gerritToken,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const data = await client.getWikiData(project.name);
      setWikiData(data);

      // 生成wiki文档
      const generator = createGerritWikiGenerator(data);
      const wiki = generator.generateCompleteWiki();
      setGeneratedWiki(wiki);
    } catch (err) {
      console.error('Failed to generate wiki:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate wiki';
      setError(errorMessage);
      showNotification({
        type: 'error',
        title: '生成失败',
        message: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateWiki = async () => {
    if (!isConfigured || !selectedProject) return;

    if (!gerritBaseUrl || !gerritUsername || !gerritToken) {
      showNotification({
        type: 'error',
        title: '配置错误',
        message: 'Gerrit配置信息不完整',
        duration: 5000,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = createGerritClient({
        id: `gerrit-${Date.now()}`,
        name: gerritBaseUrl,
        baseUrl: gerritBaseUrl,
        username: gerritUsername,
        password: gerritToken,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const data = await client.getWikiData(selectedProject.name);
      setWikiData(data);

      // 生成wiki文档
      const generator = createGerritWikiGenerator(data);
      const wiki = generator.generateCompleteWiki();
      setGeneratedWiki(wiki);
    } catch (err) {
      console.error('Failed to generate wiki:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate wiki');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedWiki);
      showNotification({
        type: 'success',
        title: '复制成功',
        message: 'Wiki内容已复制到剪贴板',
        duration: 3000,
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      showNotification({
        type: 'error',
        title: '复制失败',
        message: '复制失败，请手动复制',
        duration: 5000,
      });
    }
  };

  const downloadWiki = () => {
    if (!generatedWiki) return;

    const blob = new Blob([generatedWiki], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject?.name || 'gerrit-project'}-wiki.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isConfigured) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              <p className="text-lg mb-2">Gerrit连接未配置</p>
              <p className="text-sm">请在配置中设置Gerrit服务器地址、用户名和访问令牌</p>
            </div>
          </div>
        </div>
        <NotificationComponent />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gerrit Wiki 生成器
          </h1>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              当前配置
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">服务器地址：</span>
                <span className="text-gray-900 dark:text-white">{gerritBaseUrl}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">用户名：</span>
                <span className="text-gray-900 dark:text-white">{gerritUsername}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">状态：</span>
                <span className="text-green-600 dark:text-green-400">已连接</span>
              </div>
            </div>
          </div>

          {!selectedProject ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400 mb-4">
                <p className="text-lg mb-2">请选择要生成Wiki的Gerrit项目</p>
              </div>
              <button
                onClick={() => setShowProjectSelector(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md"
              >
                选择项目
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  已选择的项目
                </h2>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{selectedProject.name}</h3>
                    {selectedProject.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedProject.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowProjectSelector(true)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                    >
                      更换项目
                    </button>
                    <button
                      onClick={generateWiki}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                    >
                      {loading ? '生成中...' : '生成Wiki'}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
                  <strong>生成失败：</strong> {error}
                </div>
              )}

              {generatedWiki && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      生成的Wiki文档
                    </h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={copyToClipboard}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                      >
                        复制内容
                      </button>
                      <button
                        onClick={downloadWiki}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        下载Markdown
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        预览
                      </span>
                    </div>
                    <div className="p-4 max-h-96 overflow-y-auto">
                      <Markdown content={generatedWiki} />
                    </div>
                  </div>
                </div>
              )}

              {wikiData && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    项目统计信息
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {wikiData.statistics.totalChanges}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">总变更数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {wikiData.statistics.mergedChanges}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">已合并</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {wikiData.statistics.openChanges}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">开放中</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {wikiData.branches.length}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">分支数</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isConfigured && gerritBaseUrl && gerritUsername && gerritToken && showProjectSelector && (
        <GerritProjectSelector
          config={{
            id: `gerrit-${Date.now()}`,
            name: gerritBaseUrl,
            baseUrl: gerritBaseUrl,
            username: gerritUsername,
            password: gerritToken,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }}
          onClose={() => setShowProjectSelector(false)}
          onProjectSelect={handleProjectSelect}
        />
      )}

      <NotificationComponent />
    </div>
  );
}