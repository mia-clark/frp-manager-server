import { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Progress, Statistic, List, Space, Typography, Empty, Skeleton } from 'antd';
import {
  DesktopOutlined,
  CloudServerOutlined,
  FieldTimeOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';

const { Title, Text } = Typography;

interface HistoryPoint {
  time: string;
  cpu: number;
  memory: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const prevNetBytes = useRef<Record<string, number>>({});
  const [netSpeed, setNetSpeed] = useState<{ rxSpeed: number; txSpeed: number }>({ rxSpeed: 0, txSpeed: 0 });

  // 轮询定时器
  useEffect(() => {
    fetchSystemInfo(true);
    const timer = setInterval(() => {
      fetchSystemInfo(false);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0秒';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + '天 ' : ''}${h > 0 ? h + '小时 ' : ''}${m > 0 ? m + '分 ' : ''}${s}秒`;
  };

  const fetchSystemInfo = async (isFirst: boolean) => {
    try {
      const resp = await client.get('/api/v1/system/info');
      if (resp.status === 200) {
        const data = resp.data;
        setSysInfo(data);

        // 计算网卡实时速率 (对所有网卡 RX/TX 累加求差值)
        let totalRx = 0;
        let totalTx = 0;
        if (data.network && Array.isArray(data.network)) {
          data.network.forEach((nic: any) => {
            if (nic.rx_bytes) totalRx += nic.rx_bytes;
            if (nic.tx_bytes) totalTx += nic.tx_bytes;
          });
        } else if (data.network && typeof data.network === 'object') {
          // 部分系统返回的是对象结构
          Object.values(data.network).forEach((nic: any) => {
            if (nic.rx_bytes) totalRx += nic.rx_bytes;
            if (nic.tx_bytes) totalTx += nic.tx_bytes;
          });
        }

        const nowMs = Date.now();
        if (prevNetBytes.current.time) {
          const deltaSec = (nowMs - prevNetBytes.current.time) / 1000;
          if (deltaSec > 0) {
            const rxSpeed = Math.max(0, (totalRx - (prevNetBytes.current.rx || 0)) / deltaSec);
            const txSpeed = Math.max(0, (totalTx - (prevNetBytes.current.tx || 0)) / deltaSec);
            setNetSpeed({ rxSpeed, txSpeed });
          }
        }
        prevNetBytes.current = { rx: totalRx, tx: totalTx, time: nowMs };

        // 收集 CPU 与内存历史
        const processCpu = data.process?.cpu_percent || 0;
        const memoryUsedPercent = data.memory?.used_percent || 0;
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setHistory((prev) => {
          const updated = [...prev, { time: nowStr, cpu: Math.min(100, Math.max(0, processCpu)), memory: memoryUsedPercent }];
          // 保持最近 12 个采样点
          if (updated.length > 12) {
            updated.shift();
          }
          return updated;
        });

        if (isFirst) setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
        <Row gutter={[16, 16]}>
          <Col span={8}><Skeleton active avatar /></Col>
          <Col span={8}><Skeleton active avatar /></Col>
          <Col span={8}><Skeleton active avatar /></Col>
        </Row>
      </Space>
    );
  }

  // 整理内存和磁盘的值
  const memUsed = sysInfo?.memory?.used || 0;
  const memTotal = sysInfo?.memory?.total || 1;
  const memPercent = Math.round(sysInfo?.memory?.used_percent || 0);

  // 取主盘分区 (通常是列表中第一个)
  const disks = sysInfo?.disk || [];
  const mainDisk = disks[0] || { path: '/', used: 0, total: 1, used_percent: 0 };
  const diskPercent = Math.round(mainDisk.used_percent || 0);

  // CPU 使用率
  const cpuPercent = Math.round(sysInfo?.cpu?.total_percent || 0);

  return (
    <div style={{ padding: '4px' }}>
      <Title level={3} style={{ color: '#fff', marginBottom: '24px' }}>系统监控大盘</Title>

      {/* 快捷指标行 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" bordered={false} bodyStyle={{ padding: '20px' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>主机名称</span>}
              value={sysInfo?.host?.hostname || 'Unknown'}
              valueStyle={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}
              prefix={<DesktopOutlined style={{ color: '#1677ff', marginRight: '8px' }} />}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              OS: {sysInfo?.host?.os || 'Linux'} / {sysInfo?.host?.kernel_version || ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" bordered={false} bodyStyle={{ padding: '20px' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>运行时间</span>}
              value={formatUptime(sysInfo?.uptime_s)}
              valueStyle={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}
              prefix={<FieldTimeOutlined style={{ color: '#52c41a', marginRight: '8px' }} />}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              守护进程启动运行时间
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" bordered={false} bodyStyle={{ padding: '20px' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>网络吞吐</span>}
              value={formatBytes(netSpeed.rxSpeed) + '/s'}
              valueStyle={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}
              prefix={<CloudServerOutlined style={{ color: '#faad14', marginRight: '8px' }} />}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              发送: {formatBytes(netSpeed.txSpeed)}/s
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" bordered={false} bodyStyle={{ padding: '20px' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>网络连接数</span>}
              value={sysInfo?.connections?.total || 0}
              valueStyle={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}
              prefix={<DeploymentUnitOutlined style={{ color: '#eb2f96', marginRight: '8px' }} />}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              守护进程占用: {sysInfo?.connections?.process || 0} 个连接
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 资源环形卡片行 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={8}>
          <Card className="glass-card" title={<span style={{ color: '#fff' }}>CPU 使用率</span>} bordered={false} style={{ textAlign: 'center' }}>
            <Progress
              type="dashboard"
              percent={cpuPercent}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              trailColor="rgba(255,255,255,0.05)"
              format={(percent) => <span style={{ color: '#fff', fontSize: '24px' }}>{percent}%</span>}
            />
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary">{sysInfo?.cpu?.model_name || '处理器核心'}</Text>
              <div><Text type="secondary">线程数: {sysInfo?.cpu?.cores || 1} Cores</Text></div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-card" title={<span style={{ color: '#fff' }}>内存 使用率</span>} bordered={false} style={{ textAlign: 'center' }}>
            <Progress
              type="dashboard"
              percent={memPercent}
              strokeColor={{
                '0%': '#1677ff',
                '100%': '#fa8c16',
              }}
              trailColor="rgba(255,255,255,0.05)"
              format={(percent) => <span style={{ color: '#fff', fontSize: '24px' }}>{percent}%</span>}
            />
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary">已使用: {formatBytes(memUsed)} / {formatBytes(memTotal)}</Text>
              <div><Text type="secondary">Swap已用: {formatBytes(sysInfo?.memory?.swap_used || 0)}</Text></div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-card" title={<span style={{ color: '#fff' }}>磁盘 存储占用</span>} bordered={false} style={{ textAlign: 'center' }}>
            <Progress
              type="dashboard"
              percent={diskPercent}
              strokeColor={{
                '0%': '#faad14',
                '100%': '#ff4d4f',
              }}
              trailColor="rgba(255,255,255,0.05)"
              format={(percent) => <span style={{ color: '#fff', fontSize: '24px' }}>{percent}%</span>}
            />
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary">分区: {mainDisk.path} ({mainDisk.fstype || 'ext4'})</Text>
              <div><Text type="secondary">已使用: {formatBytes(mainDisk.used)} / {formatBytes(mainDisk.total)}</Text></div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 实时折线图与进程详细 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="glass-card" title={<span style={{ color: '#fff' }}>守护进程性能波动 (CPU / 内存使用)</span>} bordered={false}>
            {history.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677ff" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#52c41a" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#52c41a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#14171a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" name="进程 CPU %" dataKey="cpu" stroke="#1677ff" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                    <Area type="monotone" name="系统 内存 %" dataKey="memory" stroke="#52c41a" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={<span style={{ color: 'rgba(255,255,255,0.45)' }}>收集性能指标数据中...</span>} />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="glass-card" title={<span style={{ color: '#fff' }}>守护进程自省 (Introspection)</span>} bordered={false}>
            <List
              split={false}
              dataSource={[
                { label: '进程内存 (RSS)', value: formatBytes(sysInfo?.process?.rss || 0) },
                { label: 'Go 协程数量 (Goroutines)', value: sysInfo?.process?.num_goroutines || 0 },
                { label: '物理线程数 (Threads)', value: sysInfo?.process?.num_threads || 0 },
                { label: '句柄描述符数 (Open Files)', value: sysInfo?.process?.num_fds || 0 },
                { label: '进程启动时间', value: new Date(sysInfo?.process?.started_at).toLocaleString() },
                { label: '程序工作目录', value: sysInfo?.data_dir || '/data' },
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)' }}>{item.label}</Text>
                  <Text strong style={{ color: '#fff' }}>{item.value}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
