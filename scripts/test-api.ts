/**
 * Cloud FunctionsのREST APIをテストするスクリプト
 * 
 * 使用方法: npx ts-node scripts/test-api.ts
 */
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';

// APIのベースURL
const API_BASE_URL = 'YOUR_API_BASE_URL/api/v1';

// テスト用の認証トークン
const TEST_AUTH_TOKEN = process.env.API_TEST_TOKEN || 'test-token';

// 認証ヘッダー付きのリクエスト設定
const authConfig: AxiosRequestConfig = {
  headers: {
    'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

// レスポンスの型定義
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error?: string;
}

// カード利用情報の型定義
interface CardUsage {
  id?: string;
  path?: string;
  card_name: string;
  datetime_of_use: string | { _seconds: number; _nanoseconds: number };
  amount: number;
  where_to_use: string;
  memo?: string;
  is_active?: boolean;
  created_at?: { _seconds: number; _nanoseconds: number };
}

// テスト用データ
const testCardUsage: Omit<CardUsage, 'id' | 'path' | 'created_at'> = {
  card_name: 'テストカード',
  datetime_of_use: new Date().toISOString(), // 現在時刻
  amount: 1500,
  where_to_use: 'テスト店舗',
  memo: 'APIテスト用データ'
};

// 作成したデータのID
let createdId: string | null = null;

/**
 * ヘルスチェックエンドポイントをテスト
 */
async function testHealthCheck(): Promise<boolean> {
  try {
    console.log('1️⃣ ヘルスチェックをテスト中...');
    const response: AxiosResponse<{ status: string; message: string; timestamp: string }> =
      await axios.get('YOUR_API_BASE_URL/api/health');
    console.log('✅ ヘルスチェック成功:', response.data);
    return true;
  } catch (error: any) {
    console.error('❌ ヘルスチェック失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * カード利用データ作成APIをテスト
 */
async function testCreateCardUsage(): Promise<boolean> {
  try {
    console.log('2️⃣ カード利用データの作成をテスト中...');
    const response: AxiosResponse<ApiResponse<CardUsage>> =
      await axios.post(`${API_BASE_URL}/card-usages`, testCardUsage, authConfig);
    console.log('✅ データ作成成功:', response.data);

    // 作成したデータのIDを保存
    createdId = response.data.data?.id || null;
    console.log('📝 作成したデータのID:', createdId);
    return true;
  } catch (error: any) {
    console.error('❌ データ作成失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * カード利用データ取得APIをテスト（ID指定）
 */
async function testGetCardUsageById(): Promise<boolean> {
  if (!createdId) {
    console.log('⚠️ IDが設定されていないため、テストをスキップします');
    return false;
  }

  try {
    console.log(`3️⃣ ID: ${createdId} のカード利用データを取得中...`);
    const response: AxiosResponse<ApiResponse<CardUsage>> =
      await axios.get(`${API_BASE_URL}/card-usages/${createdId}`, authConfig);
    console.log('✅ データ取得成功:', response.data);
    return true;
  } catch (error: any) {
    console.error('❌ データ取得失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * カード利用データ一覧取得APIをテスト（年月指定）
 */
async function testGetAllCardUsages(): Promise<boolean> {
  // 今月のデータを取得
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScriptの月は0始まり

  try {
    console.log(`4️⃣ ${year}年${month}月のカード利用データ一覧を取得中...`);
    const response: AxiosResponse<ApiResponse<CardUsage[]>> =
      await axios.get(`${API_BASE_URL}/card-usages?year=${year}&month=${month}`, authConfig);
    console.log('✅ データ一覧取得成功:', response.data);
    console.log(`📊 取得したデータ数: ${response.data.data?.length || 0}`);
    return true;
  } catch (error: any) {
    console.error('❌ データ一覧取得失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * カード利用データ更新APIをテスト
 */
async function testUpdateCardUsage(): Promise<boolean> {
  if (!createdId) {
    console.log('⚠️ IDが設定されていないため、テストをスキップします');
    return false;
  }

  const updateData: Partial<CardUsage> = {
    memo: 'APIテストで更新したメモ',
    where_to_use: 'テスト店舗（更新）'
  };

  try {
    console.log(`5️⃣ ID: ${createdId} のカード利用データを更新中...`);
    const response: AxiosResponse<ApiResponse<CardUsage>> =
      await axios.put(`${API_BASE_URL}/card-usages/${createdId}`, updateData, authConfig);
    console.log('✅ データ更新成功:', response.data);
    return true;
  } catch (error: any) {
    console.error('❌ データ更新失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * カード利用データ削除APIをテスト（論理削除）
 */
async function testDeleteCardUsage(): Promise<boolean> {
  if (!createdId) {
    console.log('⚠️ IDが設定されていないため、テストをスキップします');
    return false;
  }

  try {
    console.log(`6️⃣ ID: ${createdId} のカード利用データを削除中...`);
    const response: AxiosResponse<ApiResponse<{ id: string; path: string }>> =
      await axios.delete(`${API_BASE_URL}/card-usages/${createdId}`, authConfig);
    console.log('✅ データ削除成功:', response.data);
    return true;
  } catch (error: any) {
    console.error('❌ データ削除失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * 認証なしでAPIアクセスした場合のテスト
 */
async function testAccessWithoutAuth(): Promise<boolean> {
  try {
    console.log('7️⃣ 認証なしでカード利用データ一覧アクセスをテスト中...');
    await axios.get(`${API_BASE_URL}/card-usages?year=2025&month=5`);
    console.log('❌ 認証なしで成功してしまいました（ミドルウェアが機能していない可能性があります）');
    return false;
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      console.log('✅ 正しく認証エラーになりました:', error.response.data);
      return true;
    }
    console.error('❌ 予期しないエラー:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
    return false;
  }
}

/**
 * 全テストを実行
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 APIテストを開始します...');

  // ヘルスチェック（認証不要）
  await testHealthCheck();

  // 認証なしアクセスのテスト
  await testAccessWithoutAuth();

  // 認証ありのテスト
  // データ作成
  const createSuccess = await testCreateCardUsage();

  if (createSuccess) {
    // IDによるデータ取得
    await testGetCardUsageById();

    // データ更新
    await testUpdateCardUsage();

    // 更新後の確認
    await testGetCardUsageById();

    // 論理削除
    await testDeleteCardUsage();
  }

  // 年月指定でのデータ一覧取得
  await testGetAllCardUsages();

  console.log('✨ APIテスト終了');
}

// テスト実行
runAllTests().catch(console.error);