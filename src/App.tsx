import React from 'react';
import { AppProvider } from './context/AppContext';
import ImageUploader from './components/ImageUploader';
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <AppProvider>
      <div className="min-h-screen w-full flex flex-col">
        <header className="w-full py-4 px-6 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-slate-100 shadow-sm">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
              FaceBlur
            </h1>
          </div>
        </header>
        
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <ImageUploader />
        </main>
        
        <footer className="w-full py-4 px-6 bg-white/80 backdrop-blur-sm border-t border-slate-100 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} theactualdev. Privacy Made Simple.
        </footer>
      </div>
      <Analytics />
    </AppProvider>
  );
}

export default App;