import { useState, useEffect } from 'react';
import { Card, Input, Button, Form, Typography, message } from 'antd';
import { KeyOutlined, SafetyCertificateOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client, { setAPIToken, getAPIToken } from '../api/client';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);

  // 如果已经登录，直接跳到首页
  useEffect(() => {
    if (getAPIToken()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const onFinish = async (values: { token: string }) => {
    setLoading(true);
    try {
      // 临时设置 token 来验证
      setAPIToken(values.token);
      
      const resp = await client.get('/api/v1/version');
      if (resp.status === 200) {
        message.success('连接成功，已授权登录');
        navigate('/dashboard');
      } else {
        throw new Error('鉴权未通过');
      }
    } catch (err) {
      setAPIToken(''); // 清除临时设置的错误 token
      message.error('Token 校验失败，请确认守护进程是否已配置该密钥');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at 10% 20%, rgba(90, 92, 234, 0.15) 0%, rgba(32, 45, 125, 0.05) 90%)',
    }}>
      {/* 炫酷的玻璃化登录框 */}
      <Card className="glass-card" style={{
        width: 420,
        padding: '24px 16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 18, 22, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            backgroundColor: 'rgba(22, 119, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '1px solid rgba(22, 119, 255, 0.3)',
            boxShadow: '0 0 20px rgba(22, 119, 255, 0.2)'
          }}>
            <SafetyCertificateOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          </div>
          <Title level={3} style={{ margin: '0 0 8px 0', color: '#fff', fontWeight: 600 }}>FRP 控制台登录</Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            请输入 FRP Manager 守护进程配置的 API 鉴权密钥以开始管理。
          </Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="token"
            rules={[{ required: true, message: '请输入 API 令牌密钥！' }]}
          >
            <Input.Password
              prefix={<KeyOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
              placeholder="API Token (Bearer 令牌)"
              size="large"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              style={{
                height: 44,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(22, 119, 255, 0.3)',
              }}
              icon={<ArrowRightOutlined />}
            >
              验证并进入控制台
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
