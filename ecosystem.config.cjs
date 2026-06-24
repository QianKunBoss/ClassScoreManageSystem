module.exports = {
  apps: [{
    name: 'csms',
    script: '.output/server/index.mjs',
    instances: 1,          // 必须为 1！SQLite 不支持多进程写入
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000,
      SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-to-a-random-secret',
    },
    max_memory_restart: '512M',
    error_file: './logs/csms-error.log',
    out_file: './logs/csms-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
