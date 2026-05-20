import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Configs from './pages/Configs';
import Logs from './pages/Logs';
import ImportExport from './pages/ImportExport';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 独立登录路由 */}
        <Route path="/login" element={<Login />} />
        
        {/* 主界面嵌套路由 */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="configs" element={<Configs />} />
          <Route path="logs" element={<Logs />} />
          <Route path="import-export" element={<ImportExport />} />
          {/* 其他路径默认重定向回大盘 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
