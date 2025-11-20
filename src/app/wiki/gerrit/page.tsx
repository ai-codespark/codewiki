'use client';

import React, { useState } from 'react';
import GerritWikiGeneratorIntegrated from '@/components/GerritWikiGeneratorIntegrated';
import ConfigurationModal from '@/components/ConfigurationModal';
import { useNotification } from '@/components/Notification';

export default function GerritWikiPage() {
  const { showNotification, NotificationComponent } = useNotification();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Gerrit配置状态
  const [gerritBaseUrl, setGerritBaseUrl] = useState('');
  const [gerritUsername, setGerritUsername] = useState('');
  const [gerritToken, setGerritToken] = useState('');

  // 配置模态框的状态
  const [selectedPlatform, setSelectedPlatform] = useState<'github' | 'gitlab' | 'bitbucket' | 'gerrit'>('gerrit');
  const [accessToken, setAccessToken] = useState('');

  // 其他配置状态
  const [selectedLanguage, setSelectedLanguage] = useState('zh');
  const [isComprehensiveView, setIsComprehensiveView] = useState(true);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [excludedDirs, setExcludedDirs] = useState('');
  const [excludedFiles, setExcludedFiles] = useState('');
  const [includedDirs, setIncludedDirs] = useState('');
  const [includedFiles, setIncludedFiles] = useState('');
  const [modelConfig, setModelConfig] = useState<any>(null);

  // 处理配置保存
  const handleConfigSave = () => {
    if (selectedPlatform === 'gerrit' && accessToken && gerritUsername) {
      // 提取Gerrit服务器地址
      let baseUrl = '';
      try {
        // 假设用户输入的是类似 https://gerrit.example.com 的格式
        // 或者从配置中获取
        const url = new URL(accessToken.includes('http') ? accessToken : `https://${accessToken.split('/')[0]}`);
        baseUrl = url.origin;
      } catch {
        // 如果无法解析，使用默认值或提示用户
        showNotification({
          type: 'error',
          title: '配置错误',
          message: '请确保Gerrit服务器地址格式正确',
          duration: 5000,
        });
        return;
      }

      setGerritBaseUrl(baseUrl);
      setGerritToken(accessToken);
      // gerritUsername 已经在输入时通过 setGerritUsername 设置了
      setIsConfigModalOpen(false);

      showNotification({
        type: 'success',
        title: '配置成功',
        message: 'Gerrit配置已保存',
        duration: 3000,
      });
    } else {
      showNotification({
        type: 'error',
        title: '配置错误',
        message: '请填写完整的Gerrit配置信息',
        duration: 5000,
      });
    }
  };

  // 检查是否已配置
  const isConfigured = !!(gerritBaseUrl && gerritUsername && gerritToken);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        {!isConfigured && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Gerrit Wiki 生成器
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  请配置Gerrit连接信息以开始生成Wiki文档
                </p>
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  配置Gerrit连接
                </button>
              </div>
            </div>
          </div>
        )}

        <GerritWikiGeneratorIntegrated
          gerritBaseUrl={gerritBaseUrl}
          gerritUsername={gerritUsername}
          gerritToken={gerritToken}
        />

        <ConfigurationModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          repositoryInput="Gerrit Configuration"
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          supportedLanguages={{ zh: '中文', en: 'English' }}
          isComprehensiveView={isComprehensiveView}
          setIsComprehensiveView={setIsComprehensiveView}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          isCustomModel={isCustomModel}
          setIsCustomModel={setIsCustomModel}
          customModel={customModel}
          setCustomModel={setCustomModel}
          selectedPlatform={selectedPlatform}
          setSelectedPlatform={setSelectedPlatform}
          accessToken={accessToken}
          setAccessToken={setAccessToken}
          gerritUsername={gerritUsername}
          setGerritUsername={setGerritUsername}
          excludedDirs={excludedDirs}
          setExcludedDirs={setExcludedDirs}
          excludedFiles={excludedFiles}
          setExcludedFiles={setExcludedFiles}
          includedDirs={includedDirs}
          setIncludedDirs={setIncludedDirs}
          includedFiles={includedFiles}
          setIncludedFiles={setIncludedFiles}
          onSubmit={handleConfigSave}
          isSubmitting={false}
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
        />

        <NotificationComponent />
      </div>
    </div>
  );
}