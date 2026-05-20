import { useState } from 'react';
import { Card, Row, Col, Button, Input, Radio, Form, Upload, message, Typography, Space, Divider } from 'antd';
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  LinkOutlined,
  FileZipOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import client, { getAPIToken } from '../api/client';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const ImportExport: React.FC = () => {
  const [textLoading, setTextLoading] = useState<boolean>(false);
  const [urlLoading, setUrlLoading] = useState<boolean>(false);
  const [allExportLoading, setAllExportLoading] = useState<boolean>(false);

  const [textForm] = Form.useForm();
  const [urlForm] = Form.useForm();

  // 鉴权下载：全量导出所有配置为 ZIP 包
  const handleExportAll = async () => {
    setAllExportLoading(true);
    try {
      const resp = await client.get('/api/v1/export/all', {
        responseType: 'blob', // 关键：指定二进制文件流
      });
      
      const blob = new Blob([resp.data], { type: 'application/zip' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `frp-configs-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      message.success('整包备份文件已成功导出并下载');
    } catch (err) {
      message.error('导出备份失败，请检查服务状态');
    } finally {
      setAllExportLoading(false);
    }
  };

  // 粘贴文本导入
  const handleImportText = async (values: any) => {
    setTextLoading(true);
    try {
      await client.post('/api/v1/import/text', {
        id: values.id,
        text: values.text,
        format: values.format || 'toml'
      });
      message.success(`文本配置 [${values.id}] 导入成功！`);
      textForm.resetFields();
      textForm.setFieldsValue({ format: 'toml' });
    } catch (err: any) {
      message.error('导入失败: ' + (err.response?.data?.message || err.message));
    } finally {
      setTextLoading(false);
    }
  };

  // URL 导入
  const handleImportURL = async (values: any) => {
    setUrlLoading(true);
    try {
      await client.post('/api/v1/import/url', {
        id: values.id,
        url: values.url
      });
      message.success(`URL 远程拉取配置 [${values.id}] 成功！`);
      urlForm.resetFields();
    } catch (err: any) {
      message.error('导入失败: ' + (err.response?.data?.message || err.message));
    } finally {
      setUrlLoading(false);
    }
  };

  // ZIP 备份文件整包导入上传参数
  const zipDraggerProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    headers: {
      Authorization: `Bearer ${getAPIToken()}`,
    },
    action: '/api/v1/import/zip',
    onChange(info: any) {
      const { status } = info.file;
      if (status === 'uploading') {
        // loading...
      }
      if (status === 'done') {
        message.success(`${info.file.name} ZIP 备份包恢复成功！`);
      } else if (status === 'error') {
        message.error(`${info.file.name} 备份包解析失败，请确认文件格式。`);
      }
    },
  };

  // 单文件配置导入参数
  const fileUploadProps = (id: string, onSuccess: () => void) => ({
    name: 'file',
    multiple: false,
    showUploadList: false,
    headers: {
      Authorization: `Bearer ${getAPIToken()}`,
    },
    action: `/api/v1/import/file?id=${encodeURIComponent(id)}`, // 后端 /import/file 接收 multipart 且包含 id
    beforeUpload(_: any) {
      if (!id) {
        message.warning('请先填写导入后的配置文件唯一 ID！');
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    onChange(info: any) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 配置文件导入成功！`);
        onSuccess();
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 导入失败，请检查文件编码或网络。`);
      }
    },
  });

  // 单个文件表单状态
  const [singleFileId, setSingleFileId] = useState<string>('');

  return (
    <div style={{ padding: '4px' }}>
      <Title level={3} style={{ color: '#fff', marginBottom: '24px' }}>配置备份与导入导出</Title>

      <Row gutter={[16, 16]}>
        {/* 全量整包备份 */}
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            title={<span style={{ color: '#fff' }}><FileZipOutlined /> 全量备份数据管理</span>}
            bordered={false}
            style={{ height: '100%' }}
          >
            <Paragraph type="secondary">
              在下方可以一键导出当前 FRP 管理服务中存储的全部配置文件包，下载为一个标准的 ZIP 压缩包；亦可以通过拖拽上传先前导出的 ZIP 备份文件来覆盖还原所有数据。
            </Paragraph>

            <div style={{ margin: '24px 0', textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<CloudDownloadOutlined />}
                loading={allExportLoading}
                onClick={handleExportAll}
                style={{
                  background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(82, 196, 26, 0.25)',
                  height: '48px',
                  borderRadius: '8px'
                }}
              >
                生成并下载全量备份 (.zip)
              </Button>
            </div>

            <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }}><span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>上传还原备份包</span></Divider>

            <Dragger {...zipDraggerProps} style={{ background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#1677ff' }} />
              </p>
              <p className="ant-upload-text" style={{ color: '#fff' }}>点击或拖拽 ZIP 备份文件到这里进行还原</p>
              <p className="ant-upload-hint" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                注意：整包还原将**覆盖**当前系统中所有已有的同名配置，请提前做好记录。
              </p>
            </Dragger>
          </Card>
        </Col>

        {/* 贴入文本导入 */}
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            title={<span style={{ color: '#fff' }}><CodeOutlined /> 粘贴文本配置导入</span>}
            bordered={false}
          >
            <Form form={textForm} layout="vertical" onFinish={handleImportText}>
              <Row gutter={16}>
                <Col span={14}>
                  <Form.Item
                    label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>保存 ID 标识 (纯英文数字)</span>}
                    name="id"
                    rules={[{ required: true, message: '请输入唯一ID标识' }]}
                  >
                    <Input placeholder="例如: office_linux" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>代码格式</span>}
                    name="format"
                    initialValue="toml"
                  >
                    <Radio.Group buttonStyle="solid">
                      <Radio.Button value="toml">TOML</Radio.Button>
                      <Radio.Button value="ini">INI</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>配置文件内容</span>}
                name="text"
                rules={[{ required: true, message: '请输入配置代码' }]}
              >
                <Input.TextArea
                  rows={8}
                  placeholder="[common]&#10;server_addr = x.x.x.x&#10;server_port = 7000&#10;auth.token = abcde"
                  style={{
                    fontFamily: 'Fira Code, monospace',
                    fontSize: '13px',
                    background: '#08090a',
                    color: '#e6ebf1',
                    borderColor: 'rgba(255,255,255,0.08)'
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Button type="primary" htmlType="submit" loading={textLoading}>
                  一键导入配置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        {/* 单个文件上传导入 */}
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            title={<span style={{ color: '#fff' }}><CloudUploadOutlined /> 导入本地配置文件</span>}
            bordered={false}
          >
            <Paragraph type="secondary">
              从本地计算机中选择一个现有的 FRP 客户端配置文件（`.toml` 或 `.ini` 文件）上传并导入到服务中。
            </Paragraph>

            <Space direction="vertical" style={{ width: '100%', marginTop: '8px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)' }}>输入要保存的配置 ID 标识:</Text>
              <Input
                placeholder="例如: test_server"
                value={singleFileId}
                onChange={(e) => setSingleFileId(e.target.value)}
              />
              
              <div style={{ marginTop: '8px' }}>
                <Upload {...fileUploadProps(singleFileId, () => setSingleFileId(''))}>
                  <Button type="primary" icon={<CloudUploadOutlined />} disabled={!singleFileId}>
                    选择文件并上传导入
                  </Button>
                </Upload>
                {!singleFileId && (
                  <div style={{ marginTop: '4px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>* 请先填写上方 ID 标识后激活上传按钮。</Text>
                  </div>
                )}
              </div>
            </Space>
          </Card>
        </Col>

        {/* 远程 URL 导入 */}
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            title={<span style={{ color: '#fff' }}><LinkOutlined /> 从远程 URL 下载导入</span>}
            bordered={false}
          >
            <Form form={urlForm} layout="vertical" onFinish={handleImportURL}>
              <Form.Item
                label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>保存 ID 标识 (纯英文数字)</span>}
                name="id"
                rules={[{ required: true, message: '请输入唯一ID标识' }]}
              >
                <Input placeholder="例如: remote_mac" />
              </Form.Item>

              <Form.Item
                label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>配置远程下载 URL (HTTP / HTTPS)</span>}
                name="url"
                rules={[
                  { required: true, message: '请输入下载链接' },
                  { type: 'url', message: '请输入有效的网络地址' }
                ]}
              >
                <Input placeholder="http://example.com/frpc.toml" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Button type="primary" htmlType="submit" loading={urlLoading}>
                  发起远程下载并导入
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ImportExport;
