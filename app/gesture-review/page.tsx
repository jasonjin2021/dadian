import type { Metadata } from 'next';
import GestureReview from './review-client';

export const metadata: Metadata = { title: '手势样稿 · 打点', robots: { index: false, follow: false } };

export default function GestureReviewPage() { return <GestureReview/>; }
