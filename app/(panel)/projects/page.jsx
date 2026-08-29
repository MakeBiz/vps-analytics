import { loadProjectBoard, loadSpendSummary } from '@/lib/projects';
import { Card, Empty } from '@/components/ui';
import ProjectsView from '@/components/ProjectsView';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  let board; let spend = null;
  try {
    board = await loadProjectBoard();
    spend = await loadSpendSummary();
  } catch (e) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        <Card><Empty text={'Не удалось загрузить проекты: ' + (e && e.message || e)} /></Card>
      </div>
    );
  }
  return <ProjectsView initial={board} spend={spend} />;
}
