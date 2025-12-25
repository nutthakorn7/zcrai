import { useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import { useAuth } from "./shared/store/useAuth";
import { PageContextProvider } from "./contexts/PageContext";
import { AppRoutes } from "./AppRoutes";

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
