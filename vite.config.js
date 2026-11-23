import { defineConfig } from 'vite';
const isolationHeaders={
 'Cross-Origin-Opener-Policy':'same-origin',
 'Cross-Origin-Embedder-Policy':'require-corp'
};
export default defineConfig({
 base:'./',
 server:{port:5173,strictPort:true,headers:isolationHeaders},
 preview:{headers:isolationHeaders},
 build:{target:'es2022'}
});