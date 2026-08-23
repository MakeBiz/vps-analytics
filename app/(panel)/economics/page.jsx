import { redirect } from 'next/navigation';

// Вкладка «Экономика» убрана. Старый адрес ведёт на «Обзор».
export default function Economics() {
  redirect('/');
}
