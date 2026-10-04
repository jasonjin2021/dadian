import type { Metadata } from 'next';
import './globals.css';
import './category-tabs.css';
import './game-table.css';
import './accumulate-gesture.css';
import './five-six-gesture.css';
import './five-seven-gesture.css';
import './five-eight-nine-gesture.css';
import './next-gestures.css';
import './combat-effects.css';
import './document-effects.css';
import './energy-effects.css';
import './resource-presence.css';
import './effects-review.css';
import './settlement-review.css';
import './accumulate-rendered-gesture.css';
import './game-interface.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dadian.yyxyzljyz.xyz'),
  title: '打点 · 记忆与手势的多人对决',
  description: '2–6人联机回合制手势混战。自己的点数可见，对手点数隐藏，十五秒出手，活到最后。',
  openGraph: {
    title: '打点 · 看准时机，活到最后',
    description: '2–6人联机回合制手势混战。自己的点数可见，对手点数隐藏，十五秒出手，最后存活者获胜。',
    url: 'https://dadian.yyxyzljyz.xyz',
    siteName: '打点',
    locale: 'zh_CN',
    type: 'website',
    images: [{url: '/og.png', width: 1536, height: 1024, alt: '打点 · 多人回合制手势对决'}],
  },
  twitter: {
    card: 'summary_large_image',
    title: '打点 · 看准时机，活到最后',
    description: '2–6人联机回合制手势混战。自己的点数可见，对手点数隐藏，十五秒出手，最后存活者获胜。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
