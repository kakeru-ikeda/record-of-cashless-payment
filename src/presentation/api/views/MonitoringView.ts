/**
 * サービスステータス表示データの型定義
 */
interface ServiceDisplayData {
  name: string;
  status: string;
  message: string;
  lastUpdated?: string;
  errorCount: number;
  lastErrorTime?: string;
}

/**
 * エラー表示データの型定義
 */
interface ErrorDisplayData {
  timestamp?: string;
  service: string;
  message: string;
  details?: unknown;
}

/**
 * モニタリングダッシュボード向けのビュークラス
 */
export class MonitoringView {
  /**
   * ダッシュボードのHTMLを生成する
   *
   * @param servicesData サービスステータスデータ
   * @param errorsData エラーログデータ
   * @returns レンダリングされたHTMLテンプレート
   */
  public renderDashboard(
    servicesData: ServiceDisplayData[],
    errorsData: ErrorDisplayData[]
  ): string {
    // サービスデータとエラーデータをJSON文字列化
    const servicesJson = JSON.stringify(servicesData);
    const errorsJson = JSON.stringify(errorsData);

    // テンプレートにデータを埋め込む
    const rendered = this.getHtmlTemplate()
      .replace('{{servicesData}}', servicesJson)
      .replace('{{errorsData}}', errorsJson)
      .replace('{{timestamp}}', new Date().toISOString());

    return rendered;
  }

  /**
   * HTMLテンプレートを取得します
   */
  private getHtmlTemplate(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RoCP Service Monitoring Dashboard</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .refresh-button {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
    }
    .status-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 15px;
      margin-bottom: 20px;
    }
    .status-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .status-item {
      background: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      border-left: 5px solid #ddd;
    }
    .status-name {
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 5px;
    }
    .status-info {
      color: #666;
      font-size: 14px;
    }
    .status-online { border-left-color: #2ecc71; }
    .status-warning { border-left-color: #f39c12; }
    .status-error { border-left-color: #e74c3c; }
    .status-offline { border-left-color: #95a5a6; }
    
    .error-list {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 15px;
    }
    .error-item {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    .error-time {
      color: #e74c3c;
      font-size: 12px;
    }
    .error-service {
      font-weight: bold;
    }
    .auto-refresh {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
    .loading {
      display: none;
      margin-left: 10px;
    }
    .timestamp {
      color: #666;
      font-style: italic;
      text-align: right;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="dashboard-header">
      <h1>RoCP Service Monitoring Dashboard</h1>
      <button class="refresh-button" onclick="refreshData()">更新</button>
    </div>
    
    <div class="auto-refresh">
      <label>
        <input type="checkbox" id="auto-refresh"> 
        <span>自動更新 (30秒)</span>
      </label>
      <span class="loading" id="loading-indicator">更新中...</span>
    </div>
    
    <div class="status-card">
      <h2>サービスステータス</h2>
      <div class="status-list" id="services-container">
        <!-- サービスステータスがここに動的に挿入されます -->
      </div>
    </div>
    
    <div class="error-list">
      <h2>最近のエラー</h2>
      <div id="errors-container">
        <!-- エラーログがここに動的に挿入されます -->
      </div>
    </div>
    
    <div class="timestamp" id="timestamp">
      最終更新: {{timestamp}}
    </div>
  </div>

  <script>
    // 初期データのロード
    const servicesData = {{servicesData}};
    const errorsData = {{errorsData}};
    
    // 初期表示
    document.addEventListener('DOMContentLoaded', () => {
      renderServices(servicesData);
      renderErrors(errorsData);
      
      // 自動更新のイベントリスナー
      document.getElementById('auto-refresh').addEventListener('change', function() {
        if (this.checked) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
      });
    });
    
    let refreshInterval;
    
    function startAutoRefresh() {
      refreshInterval = setInterval(refreshData, 30000);
    }
    
    function stopAutoRefresh() {
      clearInterval(refreshInterval);
    }
    
    async function refreshData() {
      const loadingIndicator = document.getElementById('loading-indicator');
      loadingIndicator.style.display = 'inline';
      
      try {
        // サービスステータスの取得
        const statusResponse = await fetch('/monitoring/status');
        const statusData = await statusResponse.json();
        
        // エラーログの取得
        const errorsResponse = await fetch('/monitoring/errors');
        const errorsData = await errorsResponse.json();
        
        // データを描画（新しいレスポンス形式に対応）
        renderServices(statusData.data.services);
        renderErrors(errorsData.data.errors);
        
        // タイムスタンプ更新
        document.getElementById('timestamp').textContent = \`最終更新: \${new Date().toLocaleString('ja-JP')}\`;
      } catch (error) {
        console.error('データ更新中にエラーが発生しました:', error);
      } finally {
        loadingIndicator.style.display = 'none';
      }
    }
    
    function renderServices(services) {
      const container = document.getElementById('services-container');
      container.innerHTML = '';
      
      if (services.length === 0) {
        container.innerHTML = '<div class="status-item">サービスデータがありません</div>';
        return;
      }
      
      services.forEach(service => {
        const statusClass = \`status-\${service.status}\`;
        const statusText = {
          'online': 'オンライン',
          'offline': 'オフライン',
          'error': 'エラー',
          'warning': '警告'
        }[service.status] || service.status;
        
        const lastError = service.lastErrorTime ? \`最終エラー: \${formatDate(service.lastErrorTime)}\` : '';
        const errorStats = service.errorCount > 0 ? \`エラー発生: \${service.errorCount}回\` : '';
        
        const html = \`
          <div class="status-item \${statusClass}">
            <div class="status-name">\${service.name}</div>
            <div class="status-info">
              <strong>\${statusText}</strong>
              \${service.message ? \`<div>\${service.message}</div>\` : ''}
              \${errorStats ? \`<div>\${errorStats}</div>\` : ''}
              \${lastError ? \`<div>\${lastError}</div>\` : ''}
              <div>更新: \${formatDate(service.lastUpdated)}</div>
            </div>
          </div>
        \`;
        
        container.innerHTML += html;
      });
    }
    
    function renderErrors(errors) {
      const container = document.getElementById('errors-container');
      container.innerHTML = '';
      
      if (errors.length === 0) {
        container.innerHTML = '<div class="error-item">エラーはありません</div>';
        return;
      }
      
      errors.forEach(error => {
        const html = \`
          <div class="error-item">
            <div class="error-time">\${formatDate(error.timestamp)}</div>
            <div class="error-service">\${error.service}</div>
            <div>\${error.message}</div>
            \${error.details ? \`<div class="error-details">\${error.details}</div>\` : ''}
          </div>
        \`;
        
        container.innerHTML += html;
      });
    }
    
    function formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleString('ja-JP');
    }
  </script>
</body>
</html>`;
  }
}
