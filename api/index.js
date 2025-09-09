const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();

// 从环境变量获取配置
const CLIENT_ID = process.env.X_API_KEY;
const CLIENT_SECRET = process.env.X_API_SECRET;
const REDIRECT_URI = process.env.CALLBACK_URL || `${process.env.VERCEL_URL}/api/callback`;
const STATE_STRING = 'my-uniq-state-123';

// 路由1: 主页
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>X头像修改器</title>
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
          .note {
            margin-top: 30px;
            padding: 15px;
            background: #e8f5fe;
            border-radius: 10px;
            font-size: 14px;
            color: #657786;
          }
        </style>
    </head>
    <body>
        <div class="container">
          <h1>X头像修改器</h1>
          <p>点击下方按钮授权我们来更新你的头像。</p>
          <a class="btn" href="/api/auth">Login with X</a>
          
          <div class="note">
            <strong>注意：</strong> 这是一个演示应用。实际修改头像功能将在授权成功后实现。
          </div>
        </div>
    </body>
    </html>
  `);
});

// 路由2: 启动OAuth流程
app.get('/api/auth', (req, res) => {
  const authUrl = `https://twitter.com/i/oauth2/authorize?${
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'tweet.read users.read offline.access',
      state: STATE_STRING,
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    })
  }`;
  res.redirect(authUrl);
});

// 路由3: 回调处理
app.get('/api/callback', async (req, res) => {
  const { code, state } = req.query;

  if (state !== STATE_STRING) {
    return res.status(400).send('State validation failed.');
  }

  try {
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎉 授权成功！</h1>
          <p>我们已经成功从X获得了访问权限。</p>
          <p>你的访问令牌（已隐藏）： ${accessToken.substring(0, 10)}...</p>
          <p><strong>下一步</strong>：在实际的应用中，我们将使用这个令牌调用API来修改你的头像。</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    res.status(500).send('Authentication failed. Check the server logs.');
  }
});

// 导出Express API
module.exports = app;