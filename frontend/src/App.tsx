import { useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import { useAuth } from "./shared/store/useAuth";
import { PageContextProvider } from "./contexts/PageContext";
import { AppRoutes } from "./AppRoutes";
import { useNotificationSocket } from "./shared/hooks/useNotificationSocket";
import { toast } from "react-hot-toast";
// import { Icon } from "./shared/ui"; 
// If Icon is not easily available, I can use emoji or standard icons. 
// Checking DashboardPage import: import { Icon } from '../../shared/ui'; -> So valid path from App.tsx (src/App.tsx) might be ./shared/ui

// Import logos for preloading
import sentineloneLogo from './assets/logo/sentinelone.png';
import crowdstrikeLogo from './assets/logo/crowdstrike.png';

// Preload images
const preloadImages = () => {
  const images = [sentineloneLogo, crowdstrikeLogo];
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

function App() {
  const { checkAuth } = useAuth();
  const hasCheckedAuth = useRef(false);
  
  // 🔥 Global Real-time Notifications
  const { lastNotification } = useNotificationSocket();

  useEffect(() => {
    if (lastNotification) {
      // Determine Icon based on type
      let icon = '🔔';
      if (lastNotification.type.includes('approval')) icon = '📝';
      if (lastNotification.type.includes('assigned')) icon = '👉';
      if (lastNotification.type.includes('success')) icon = '✅';
      if (lastNotification.type.includes('error') || lastNotification.type.includes('fail')) icon = '❌';

      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-[#1A1D1F] border border-white/10 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <span className="text-2xl">{icon}</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  {lastNotification.title}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {lastNotification.message}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-white/10">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary hover:text-primary-400 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      ), { duration: 5000 });
    }
  }, [lastNotification]);

  useEffect(() => {
    // Don't check auth on login/register pages to avoid 401 loop
    const isAuthPage = window.location.pathname.startsWith('/login') || 
                       window.location.pathname.startsWith('/register');
    
    if (!hasCheckedAuth.current && !isAuthPage) {
      hasCheckedAuth.current = true;
      checkAuth();
      preloadImages();
    } else if (isAuthPage) {
      // Just preload images on auth pages
      preloadImages();
    }
  }, [checkAuth]);

  return (
    <PageContextProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </PageContextProvider>
  );
}

export default App;
