import fs from 'node:fs';
import {spawn, execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {createDemo} from './hub-demo.mjs';

const demo = await createDemo(18647);
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '15177', '--strictPort'], {stdio: 'ignore', windowsHide: true});
let browser;
let context;
let video;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:15177')).ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({channel: 'msedge', headless: true});
  context = await browser.newContext({
    viewport: {width: 1440, height: 900},
    recordVideo: {dir: 'qa-hub/video', size: {width: 1440, height: 900}}
  });
  await context.addInitScript(config => localStorage.setItem('aureum:hub:v1', JSON.stringify(config)), demo.config);
  const page = await context.newPage();
  video = page.video();
  await page.goto('http://127.0.0.1:15177');
  await page.getByRole('button', {name: '查看 Re:Campus · 校园物品循环计划', exact: true}).waitFor();
  await page.getByLabel('演示钱包').selectOption('2');
  await page.getByRole('button', {name: '连接钱包', exact: true}).click();
  await page.getByRole('status').filter({hasText: '连接钱包完成'}).waitFor();
  await page.waitForTimeout(1200);

  for (let i = 0; i < 3; i++) {
    const add = page.getByRole('button', {name: '＋ 加入支持篮', exact: true}).first();
    await add.scrollIntoViewIfNeeded();
    await add.click();
    await page.waitForTimeout(650);
  }
  const basket = page.getByRole('region', {name: '灵感支持篮'});
  await basket.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await basket.getByLabel('每份支持数量').fill('1');
  await page.waitForTimeout(1000);

  fs.mkdirSync('submission/screenshots', {recursive: true});
  await page.screenshot({path: 'submission/screenshots/03-batch-basket.png'});
  await basket.getByRole('button', {name: '授权并批量支持', exact: true}).click();
  await page.getByRole('status').filter({hasText: '批量支持完成'}).waitFor();
  await page.waitForTimeout(1500);

  const evidence = page.getByRole('region', {name: '链上凭证'});
  await evidence.scrollIntoViewIfNeeded();
  await evidence.getByText('supportBatch', {exact: true}).waitFor();
  await page.waitForTimeout(2600);
  const network = page.getByRole('region', {name: '公共网络证据'});
  await network.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);

} finally {
  if (context) await context.close();
  if (video) {
    const source = await video.path();
    fs.mkdirSync('submission', {recursive: true});
    fs.copyFileSync(source, 'submission/aureum-demo.webm');
    try {
      execFileSync('ffmpeg', ['-y', '-i', 'submission/aureum-demo.webm', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'submission/aureum-demo.mp4'], {stdio: 'ignore'});
      console.log('Saved submission/aureum-demo.mp4');
    } catch (error) {
      console.log('ffmpeg unavailable; kept submission/aureum-demo.webm');
    }
  }
  if (browser) await browser.close();
  vite.kill();
  try { demo.provider.destroy(); } catch {}
  try { await demo.server.close(); } catch {}
}
