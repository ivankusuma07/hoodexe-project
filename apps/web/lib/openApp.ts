import { APPS, type AppId } from '@/components/apps/meta';
import { useWindows } from '@/store/windows';

export function openApp(appId: AppId) {
  const { title, w, h } = APPS[appId];
  return useWindows.getState().open({ appId, title, w, h });
}
