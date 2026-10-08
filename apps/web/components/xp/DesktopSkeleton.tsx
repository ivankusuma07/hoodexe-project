import { Wallpaper } from './Wallpaper';
import desktop from './Desktop.module.css';
import taskbar from './Taskbar.module.css';

/** Server-rendered first paint while the wallet-aware desktop loads in the browser. */
export function DesktopSkeleton() {
  return (
    <div className={desktop.desktop} aria-busy="true">
      <Wallpaper />
      <div className={taskbar.taskbar}>
        <span className={taskbar.start}>start</span>
        <span className={taskbar.tabs} />
        <span className={taskbar.tray} />
      </div>
    </div>
  );
}
