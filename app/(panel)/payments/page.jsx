import { redirect } from 'next/navigation';

// Вкладка «Оплаты» объединена с «Партнёрки Директ». Старый адрес ведёт туда же,
// чтобы закладки не ломались.
export default function Payments() {
  redirect('/royalties');
}
