const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();

// 从环境变量获取配置
const CLIENT_ID = process.env.X_API_KEY;
const CLIENT_SECRET = process.env.X_API_SECRET;
const REDIRECT_URI = process.env.CALLBACK_URL;
const STATE_STRING = 'my-uniq-state-123';

// 路由1: 主页 - 提供一个简单的登录按钮
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>X授权测试</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            text-align: center; 
            padding: 50px; 
            max-width: 600px;
            margin: 0 auto;
            background-color: #f5f8fa;
            color: #14171a;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #1da1f2; }
          .btn { 
            background: #1da1f2; 
            color: white; 
            padding: 15px 25px; 
            border-radius: 50px; 
            text-decoration: none; 
            display: inline-block; 
            font-weight: bold;
            margin-top: 20px;
          }
          .btn:hover { background: #1a91da; }
          .success { color: #17bf63; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
          <h1>X授权测试应用</h1>
          <p>这是一个极简测试，只验证OAuth授权流程，不修改任何用户数据。</p>
          <a class="btn" href="/api/auth">测试X登录</a>
        </div>
    </body>
    </html>
  `);
});

// 路由2: 启动OAuth流程
app.get('/api/auth', (req, res) => {
  // 只请求最基本的读取权限，不请求修改权限
  const authUrl = `https://twitter.com/i/oauth2/authorize?${
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'tweet.read users.read', // 只保留读取权限，移除account.write
      state: STATE_STRING,
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    })
  }`;
  res.redirect(authUrl);
});

// 路由3: 回调处理 - 简化版，只验证授权，不修改头像
app.get('/api/callback', async (req, res) => {
  const { code, state } = req.query;

  if (state !== STATE_STRING) {
    return res.status(400).send('State验证失败');
  }

  try {
    // 1. 使用授权码获取访问令牌
    const tokenResponse = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      querystring.stringify({
        code: code,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: 'challenge',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    
    // 2. 只获取用户基本信息，不修改任何内容
    const userResponse = await axios.get(
      'https://api.twitter.com/1.1/account/verify_credentials.json',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    const userData = userResponse.data;
    
    // 3. 显示成功信息和基本用户数据
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>授权成功！</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background-color: #f5f8fa;
            color: #14171a;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 600px;
            margin: 0 auto;
          }
          h1 { color: #17bf63; }
          .user-info {
            text-align: left;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            overflow-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎉 授权测试成功！</h1>
          <p>OAuth流程已完全正常工作！以下是你的用户信息：</p>
          
          <div class="user-info">
            <p><strong>用户名:</strong> ${userData.screen_name}</p>
            <p><strong>姓名:</strong> ${userData.name}</p>
            <p><strong>用户ID:</strong> ${userData.id_str}</p>
            <p><strong>访问令牌:</strong> ${accessToken.substring(0, 15)}...</p>
          </div>
          
          <p>这说明你的应用配置是正确的，可以成功获取X用户授权。</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('完整错误信息:', error.response?.data || error.message);
    
    // 显示更详细的错误信息以便诊断
    const errorData = error.response?.data || {};
    res.status(500).send(`
      <div style="text-align: center; padding: 50px;">
        <h1 style="color: #e0245e;">❌ 授权失败</h1>
        <div style="text-align: left; background: #ffe6e6; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 500px;">
          <p><strong>错误信息:</strong> ${errorData.error || error.message}</p>
          <p><strong>错误描述:</strong> ${errorData.error_description || '无详细描述'}</p>
        </div>
        <p>请检查X开发者门户中的应用配置，特别是Callback URL和权限设置。</p>
      </div>
    `);
  }
});

// 导出Express API
module.exports = app;