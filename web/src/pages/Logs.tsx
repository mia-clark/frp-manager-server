import { useEffect, useState, useRef } from 'react';
import { Card, Select, Button, Space, Input, Switch, Typography, Empty, message, Badge } from 'antd';
import {
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import client, { getAPIToken } from '../api/client';

const { Title, Text } = Typography;
const { Option } = Select;

interface ConfigOption {
  id: string;
  name: string;
  status: string;
}

const Logs: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    fetchConfigs();
    return () => {
      disconnectWS();
    };
  }, []);

  // 监控日志自动滚动
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // 当选择不同实例时，重新连接日志 WS
  useEffect(() => {
    if (selectedId) {
      connectWS(selectedId);
    } else {
      disconnectWS();
      setLogs([]);
    }
  }, [selectedId]);

  const fetchConfigs = async () => {
    try {
      const resp = await client.get('/api/v1/configs');
      if (resp.status === 200) {
        const items = resp.data?.items || resp.data || [];
        // 并行拉取各配置的状态
        const mapped = await Promise.all(items.map(async (item: any) => {
          let state = 'stopped';
          try {
            const stResp = await client.get(`/api/v1/configs/${item.id}/status`);
            state = stResp.data?.status || 'stopped';
          } catch (e) {}
          return {
            id: item.id,
            name: item.frpmgr?.name || item.id,
            status: state
          };
        }));
        setConfigs(mapped);
        
        // 默认选中第一个在运行的，若无则选中第一个
        const running = mapped.find(c => c.status === 'running');
        if (running) {
          setSelectedId(running.id);
        } else if (mapped.length > 0) {
          setSelectedId(mapped[0].id);
        }
      }
    } catch (err) {
      message.error('加载实例列表失败');
    }
  };

  const connectWS = (configId: string) => {
    disconnectWS();
    setLogs([]);
    setWsStatus('connecting');

    // 拼装 WebSocket 协议地址与 Token 参数
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getAPIToken();
    // 使用 token 查询参数鉴权
    const wsUrl = `${protocol}//${host}/api/v1/configs/${configId}/logs/tail?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        message.info(`已开启实例 [${configId}] 实时日志流`);
      };

      ws.onmessage = (event) => {
        if (isPaused) return;

        try {
          const data = JSON.parse(event.data);
          if (data && typeof data.line === 'string') {
            setLogs((prev) => {
              const updated = [...prev, data.line];
              // 限制最大行数以防浏览器卡死
              if (updated.length > 1000) {
                updated.shift();
              }
              return updated;
            });
          }
        } catch (e) {
          // 若不是 JSON，直接当作普通文本添加
          if (typeof event.data === 'string') {
            setLogs((prev) => [...prev, event.data]);
          }
        }
      };

      ws.onerror = () => {
        setWsStatus('disconnected');
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
      };
    } catch (err) {
      setWsStatus('disconnected');
      message.error('WebSocket 连接建立失败');
    }
  };

  const disconnectWS = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('disconnected');
  };

  // 根据日志级别获取对应的 CSS 类
  const getLogLineClass = (line: string): string => {
    if (line.includes('[W]') || line.toLowerCase().includes('warn')) return 'log-line log-warn';
    if (line.includes('[E]') || line.toLowerCase().includes('error')) return 'log-line log-error';
    if (line.includes('[D]') || line.toLowerCase().includes('debug')) return 'log-line log-debug';
    if (line.includes('[I]') || line.toLowerCase().includes('info')) return 'log-line log-info';
    return 'log-line';
  };

  // 过滤后的日志
  const filteredLogs = logs.filter(line => 
    line.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>实时日志流监控</Title>
        
        <Space style={{ marginLeft: 'auto' }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)' }}>选择实例:</Text>
          <Select
            value={selectedId}
            onChange={setSelectedId}
            style={{ width: 220 }}
            dropdownStyle={{ background: '#14171a' }}
          >
            {configs.map(c => (
              <Option key={c.id} value={c.id}>
                <Space>
                  <span className={c.status === 'running' ? 'status-indicator-running' : 'status-indicator-stopped'} style={{ width: 6, height: 6 }} />
                  {c.name} {c.status === 'running' ? '(运行中)' : ''}
                </Space>
              </Option>
            ))}
          </Select>
          
          <Badge
            status={wsStatus === 'connected' ? 'success' : wsStatus === 'connecting' ? 'processing' : 'default'}
            text={
              <span style={{ color: wsStatus === 'connected' ? '#52c41a' : wsStatus === 'connecting' ? '#1677ff' : '#bfbfbf' }}>
                {wsStatus === 'connected' ? 'WS已连接' : wsStatus === 'connecting' ? '连接中...' : '断开'}
              </span>
            }
          />
        </Space>
      </div>

      <Card
        className="glass-card"
        bordered={false}
        bodyStyle={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '450px' }}
      >
        {/* 控制工具条 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space>
            <Input
              placeholder="过滤日志关键字..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ width: 220, background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.08)' }}
              allowClear
            />
            <Button
              icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => setIsPaused(!isPaused)}
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {isPaused ? '继续接收' : '暂停接收'}
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setLogs([])}
              style={{ borderColor: 'rgba(255,77,79,0.2)' }}
            >
              清空面板
            </Button>
          </Space>

          <Space>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>自动滚动底部:</Text>
            <Switch checked={autoScroll} onChange={setAutoScroll} size="small" />
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => {
                if (logContainerRef.current) {
                  logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                }
              }}
            />
          </Space>
        </div>

        {/* 终端主体 */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
          {selectedId ? (
            <pre
              ref={logContainerRef}
              className="terminal-container"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                margin: 0,
                overflowY: 'auto',
              }}
            >
              {filteredLogs.length > 0 ? (
                filteredLogs.map((line, index) => (
                  <div key={index} className={getLogLineClass(line)}>
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                  {filterText ? '未搜索到匹配的日志行' : '暂无日志输出，等待 WebSocket 数据推送...'}
                </div>
              )}
            </pre>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090a' }}>
              <Empty description={<span style={{ color: 'rgba(255,255,255,0.3)' }}>请先选择一个处于运行状态的 FRP 实例</span>} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Logs;
