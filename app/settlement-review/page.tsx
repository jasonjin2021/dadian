import type { Metadata } from 'next';
import SettlementReview from './review-client';
export const metadata:Metadata={title:'结算与配音清单 · 打点',robots:{index:false,follow:false}};
export default function Page(){return <SettlementReview/>;}
