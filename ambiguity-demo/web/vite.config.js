import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 서버(npm run dev, :5173)에서 /api 요청을 FastAPI 백엔드(:8010)로 프록시.
// 배포용은 `npm run build` → dist/ 를 FastAPI(app.py)가 그대로 서빙.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8010' },
  },
  build: { outDir: 'dist' },
})
