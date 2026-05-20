import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Space, Typography, message, Modal } from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  FileTextOutlined,
  SwapOutlined,
  PoweroffOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import client, { getAPIToken, clearAPIToken } from '../api/client';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [version, setVersion] = useState<string>('获取中...');
  const [frpVer, setFrpVer] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // 如果没有 Token，直接重定向到登录页
  useEffect(() => {
    const token = getAPIToken();
    if (!token) {
      navigate('/login');
    } else {
      fetchSystemVersion();
    }
  }, [navigate]);

  // 获取后端 Go 程序版本号
  const fetchSystemVersion = async () => {
    try {
      const resp = await client.get('/api/v1/version');
      if (resp.status === 200) {
        setVersion(resp.data.version || '1.0.0');
        setFrpVer(resp.data.frp || '');
        setIsConnected(true);
      }
    } catch (err) {
      setIsConnected(false);
      message.error('无法连接到 Go 服务端，请检查 Token 权限或后端运行状态');
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: '确认注销登录？',
      content: '退出后将清除保存在本地的 API 令牌，需重新输入才能使用控制台。',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        clearAPIToken();
        message.success('注销成功');
        navigate('/login');
      },
    });
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘大盘',
    },
    {
      key: '/configs',
      icon: <SettingOutlined />,
      label: 'FRP 实例管理',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '实时日志流',
    },
    {
      key: '/import-export',
      icon: <SwapOutlined />,
      label: '备份导入导出',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      {/* 侧边栏 */}
      <Sider
        width={240}
        theme="dark"
        style={{
          background: 'rgba(15, 18, 22, 0.85)',
          backdropFilter: 'blur(10px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '8px'
        }}>
          <SafetyCertificateOutlined style={{ fontSize: '20px', color: '#1677ff' }} />
          <Text strong style={{ color: '#fff', fontSize: '16px', letterSpacing: '1px' }}>FRP Manager</Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
          style={{ background: 'transparent', marginTop: '16px' }}
        />
      </Sider>

      {/* 主工作区 */}
      <Layout style={{ background: 'transparent' }}>
        {/* 顶栏 */}
        <Header style={{
          background: 'rgba(15, 18, 22, 0.65)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64
        }}>
          <Space size="middle">
            <span className={isConnected ? 'status-indicator-running' : 'status-indicator-error'} />
            <Text style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }}>
              {isConnected ? 'API 已联通' : 'API 已断开'}
            </Text>
          </Space>

          <Space size="large">
            <Space size="small">
              <LinkOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Daemon: v{version} {frpVer && `(frp: ${frpVer})`}
              </Text>
            </Space>
            <Button
              type="text"
              danger
              icon={<PoweroffOutlined />}
              onClick={handleLogout}
            >
              安全登出
            </Button>
          </Space>
        </Header>

        {/* 内容区 */}
        <Content style={{
          margin: '24px',
          padding: '0',
          overflowY: 'auto',
          height: 'calc(100vh - 112px)'
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
