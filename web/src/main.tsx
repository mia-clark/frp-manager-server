import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        // 开启 Ant Design 官方暗黑主题算法
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',          // 科技蓝主色
          colorSuccess: '#52c41a',          // 运行正常状态绿
          colorError: '#ff4d4f',            // 异常错误状态红
          colorWarning: '#faad14',          // 警告状态黄
          borderRadius: 8,                  // 精细的小圆角
          colorBgContainer: 'rgba(20, 24, 30, 0.75)', // 玻璃拟态内层卡片底色
          colorBorder: 'rgba(255, 255, 255, 0.08)',   // 极细微边框线
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
