import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, X, Share2, Save, Trash2, Smartphone, Moon, Sun, 
  ArrowLeft, Image as ImageIcon, ScanLine, CheckCircle2, 
  Grid, Home, Edit2, RotateCcw, Check, Camera,
  Settings as SettingsIcon, ChevronRight, AlertTriangle,
  Search, BarChart3, TrendingUp, ChevronDown, RefreshCw,
  Clock, Receipt, ImagePlus
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import Cropper from 'react-easy-crop';
import jsQR from 'jsqr';
import { QRData, ViewState, ExpenseRecord } from './types';
import { THEMES } from './constants';
import { readQRFromImage, getCroppedImg, preprocessImage } from './utils/qrHelpers';
import { QRCard } from './components/QRCard';
import { Logo } from './components/Logo';
import { ExpenseGraph } from './components/ExpenseGraph';

// Local Storage Keys
const STORAGE_KEY = 'qsend_vault_v1';
const EXPENSE_KEY = 'qsend_expenses_v1';

// Shared Styles for Interactions
const BTN_TAP = "active:scale-[0.96] transition-transform duration-200 ease-premium";
const BTN_ICON = "transition-transform duration-300 group-active:scale-90 group-hover:scale-110 ease-premium";

const App = () => {
  const [view, setView] = useState<ViewState>('home');
  const [isDark, setIsDark] = useState(false);
  
  // Logic State
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success'>('scanning');
  const [error, setError] = useState<string | null>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [cameraError, setCameraError] = useState(false);

  // Save Flow State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStep, setSaveStep] = useState<'confirm' | 'label' | 'success'>('confirm');
  const [pendingQRData, setPendingQRData] = useState<string | null>(null);
  const [qrLabel, setQrLabel] = useState('');
  const [currentQRId, setCurrentQRId] = useState<string | null>(null);

  // Editor State
  const [currentRawQR, setCurrentRawQR] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [selectedThemeId, setSelectedThemeId] = useState<string>(THEMES[0].id);
  const [customBackground, setCustomBackground] = useState<string | null>(null);

  // Vault/Gallery State
  const [savedQRs, setSavedQRs] = useState<QRData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempEditLabel, setTempEditLabel] = useState('');

  // Expenses State
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseView, setExpenseView] = useState<'week' | 'month' | 'year'>('week');
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);

  // Confirmation Modal State
  const [confirmAction, setConfirmAction] = useState<'deleteAll' | 'emptyBin' | 'deleteItem' | 'resetExpenses' | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Interaction State for Delete Shake
  const [shakingId, setShakingId] = useState<string | null>(null);

  // Cropper State
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Initialize Theme and Storage
  useEffect(() => {
    // Theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }

    // Load Gallery
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedQRs(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load gallery', e);
    }

    // Load Expenses
    try {
      const storedExpenses = localStorage.getItem(EXPENSE_KEY);
      if (storedExpenses) {
        setExpenses(JSON.parse(storedExpenses));
      }
    } catch (e) {
      console.error('Failed to load expenses', e);
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (cropImage) {
        URL.revokeObjectURL(cropImage);
      }
    };
  }, [cropImage]);

  // Clean up camera
  useEffect(() => {
    if (view !== 'camera') {
      stopCameraStream();
    }
  }, [view]);

  // Auto-clear error after 4 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // --- Actions ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomBackground(reader.result as string);
        setSelectedThemeId(''); // Clear predefined theme selection
      };
      reader.readAsDataURL(file);
    }
    if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    setIsScanning(true);
    setScanStatus('scanning');
    setError(null);
    setIsLoading(true);

    let processedFile: Blob | File = file;
    try {
      processedFile = await preprocessImage(file);
    } catch (err) {
      console.error("Preprocessing failed", err);
      setError("Unable to read this image. Please try another file.");
      setIsScanning(false);
      setIsLoading(false);
      return;
    }

    const minTimePromise = new Promise(resolve => setTimeout(resolve, 800));
    
    let detectedData: string | null = null;
    try {
      detectedData = await readQRFromImage(processedFile);
    } catch (err) {
      // Detection failed, we will show cropper
    }

    await minTimePromise;
    
    if (detectedData) {
      handleScanSuccess(detectedData);
    } else {
      setIsScanning(false);
      setIsLoading(false);
      try {
        const objectUrl = URL.createObjectURL(processedFile);
        setCropImage(objectUrl);
        setView('cropper');
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setError('Manual crop required. Please frame the QR code.');
      } catch (e) {
        setError("Failed to load image for alignment.");
      }
    }
  };

  const onCropConfirm = async () => {
    if (!cropImage || !croppedAreaPixels) return;
    
    setIsScanning(true);
    setScanStatus('scanning');
    
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 800));
    let detectedData: string | null = null;

    try {
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      const croppedUrl = URL.createObjectURL(croppedBlob);
      detectedData = await readQRFromImage(croppedUrl);
      URL.revokeObjectURL(croppedUrl);
    } catch (e) {
      // Error handled below
    }

    await minTimePromise;

    if (detectedData) {
      handleScanSuccess(detectedData);
    } else {
      setIsScanning(false);
      setError("Still can't detect a valid QR code. Ensure it's clear and centered.");
    }
  };

  const handleScanSuccess = (data: string) => {
    setScanStatus('success');
    setTimeout(() => {
      setIsScanning(false);
      setIsLoading(false);
      setPendingQRData(data);
      setQrLabel('');
      setSaveStep('confirm');
      setShowSaveModal(true);
      if (cropImage) setCropImage(null);
      if (view === 'camera') stopCameraStream();
    }, 600);
  };

  // --- Camera Logic ---

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
    if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
    }
  };

  const handleStartCamera = async () => {
    setView('camera');
    setCameraError(false);
    setTimeout(initCamera, 100);
  };

  const initCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            await videoRef.current.play();
            requestAnimationFrame(scanFrame);
        }
    } catch (e) {
        console.error("Camera Error:", e);
        setCameraError(true);
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
    }

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    handleScanSuccess(code.data);
                    return; 
                }
            }
        } catch (e) {
            // Silently fail frame scan to prevent loop crash
            console.warn("Frame scan failed", e);
        }
    }
    animationRef.current = requestAnimationFrame(scanFrame);
  };

  // --- Expense Logic ---

  const trackExpense = (amountVal: string, label: string) => {
    if (!amountVal) return;
    const val = parseFloat(amountVal);
    if (!isNaN(val) && val > 0) {
      const newExpense: ExpenseRecord = {
        id: Date.now().toString(),
        amount: val,
        timestamp: Date.now(),
        label: label
      };
      const updated = [...expenses, newExpense];
      setExpenses(updated);
      localStorage.setItem(EXPENSE_KEY, JSON.stringify(updated));
    }
  };

  const getExpenseSummary = () => {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const weekTotal = expenses
      .filter(e => e.timestamp >= startOfWeek.getTime())
      .reduce((sum, e) => sum + e.amount, 0);

    const monthTotal = expenses
      .filter(e => e.timestamp >= startOfMonth.getTime())
      .reduce((sum, e) => sum + e.amount, 0);

    const yearTotal = expenses
      .filter(e => e.timestamp >= startOfYear.getTime())
      .reduce((sum, e) => sum + e.amount, 0);

    return { weekTotal, monthTotal, yearTotal };
  };

  const getRecentExpenses = () => {
    return [...expenses]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  };

  const getGraphData = () => {
    const now = new Date();
    let data: number[] = [];
    let labels: string[] = [];
    let type: 'bar' | 'line' = 'bar';
    
    if (expenseView === 'week') {
      type = 'bar';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      // Reorder to start from Monday
      const displayDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      const currentDayIndex = now.getDay(); // 0 is Sunday
      // We want to show the current week (Mon-Sun)
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7; // Get current day number, converting Sun(0) to 7
      if (day !== 1) startOfWeek.setHours(-24 * (day - 1)); // Go back to Monday
      startOfWeek.setHours(0,0,0,0);

      const weekData = new Array(7).fill(0);
      expenses.forEach(e => {
        if (e.timestamp >= startOfWeek.getTime()) {
           const d = new Date(e.timestamp);
           let dayIdx = d.getDay() - 1; // Mon=0, Sun=6
           if (dayIdx < 0) dayIdx = 6;
           weekData[dayIdx] += e.amount;
        }
      });
      data = weekData;
      labels = displayDays;

    } else if (expenseView === 'month') {
      type = 'line';
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthData = new Array(daysInMonth).fill(0);
      
      expenses.forEach(e => {
        if (e.timestamp >= startOfMonth.getTime()) {
          const day = new Date(e.timestamp).getDate();
          monthData[day - 1] += e.amount;
        }
      });
      data = monthData;
      // Show fewer labels for month
      labels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());

    } else if (expenseView === 'year') {
      type = 'bar';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const yearData = new Array(12).fill(0);

      expenses.forEach(e => {
        if (e.timestamp >= startOfYear.getTime()) {
          const month = new Date(e.timestamp).getMonth();
          yearData[month] += e.amount;
        }
      });
      data = yearData;
      labels = months;
    }

    return { data, labels, type, max: Math.max(...data, 100) };
  };

  const handleResetExpenses = () => {
    setExpenses([]);
    localStorage.removeItem(EXPENSE_KEY);
    setConfirmAction(null);
  };

  // --- Save & Share Logic ---

  const handleSkipSave = () => {
    if (pendingQRData) {
      setCurrentRawQR(pendingQRData);
      setAmount('');
      setSelectedThemeId(THEMES[0].id);
      setCustomBackground(null);
      setCurrentQRId(null);
      setShowSaveModal(false);
      setView('editor');
    }
  };

  const handleConfirmSave = () => {
    setSaveStep('label');
  };

  const handleSaveLabelSubmit = () => {
    if (!qrLabel.trim() || !pendingQRData) return;

    const newId = Date.now().toString();
    const newQR: QRData = {
      id: newId,
      rawValue: pendingQRData,
      createdAt: Date.now(),
      label: qrLabel.trim(),
      amount: '',
      themeId: selectedThemeId || undefined,
      customBackground: customBackground || undefined,
    };

    const updated = [newQR, ...savedQRs];
    setSavedQRs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setSaveStep('success');
    setTimeout(() => {
      setShowSaveModal(false);
      setCurrentRawQR(pendingQRData);
      setAmount('');
      setSelectedThemeId(THEMES[0].id);
      setCustomBackground(null);
      setCurrentQRId(newId);
      setView('editor');
    }, 800);
  };

  const handleSaveToGallery = () => {
    const label = qrLabel || (currentQRId ? savedQRs.find(q => q.id === currentQRId)?.label : 'Saved Payment QR');
    if (currentQRId) {
      const updated = savedQRs.map(q => {
        if (q.id === currentQRId) {
          return { 
            ...q, 
            amount, 
            themeId: selectedThemeId || undefined,
            customBackground: customBackground || undefined
          };
        }
        return q;
      });
      setSavedQRs(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      const newId = Date.now().toString();
      const newQR: QRData = {
        id: newId,
        rawValue: currentRawQR,
        createdAt: Date.now(),
        label: label || 'Saved Payment QR',
        amount,
        themeId: selectedThemeId || undefined,
        customBackground: customBackground || undefined,
      };
      const updated = [newQR, ...savedQRs];
      setSavedQRs(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCurrentQRId(newId);
    }
    // Show quick feedback
    setScanStatus('success'); 
    setTimeout(() => {
        setScanStatus('scanning'); // reset logic
        setView('gallery');
    }, 400);
  };

  const handleShare = async () => {
    const node = document.getElementById('qr-card-preview');
    if (!node) return;

    try {
      setIsLoading(true);

      // Force a slight delay to ensure React has fully committed any layout changes
      await new Promise(resolve => setTimeout(resolve, 200));

      const blob = await htmlToImage.toBlob(node, { 
        pixelRatio: 2, // Reduced from 3 for better mobile stability and memory usage
        cacheBust: true,
        skipAutoScale: true,
        style: {
          transform: 'scale(1)', 
          boxShadow: 'none', 
        }
      });

      if (!blob || blob.size === 0) throw new Error('Failed to generate image');

      const file = new File([blob], 'qsend-payment.png', { type: 'image/png' });
      
      // Determine label for expense tracking
      const activeLabel = qrLabel || (currentQRId ? savedQRs.find(q => q.id === currentQRId)?.label : undefined) || 'Payment';

      if (navigator.share) {
        const shareData: ShareData = {
          files: [file],
          title: 'Qsend Payment QR',
          text: 'Shared via Qsend', // Valid non-empty text required by some platforms
        };
        
        // Check if the device/browser supports sharing this data
        if (navigator.canShare && !navigator.canShare(shareData)) {
             throw new Error("Device does not support sharing this content.");
        }

        try {
          await navigator.share(shareData);
          // Auto-track expense on successful share invocation
          trackExpense(amount, activeLabel);
        } catch (e) {
            // Ignore AbortError which happens when user cancels the share dialog
            if (e instanceof Error && e.name !== 'AbortError') {
              console.warn('Share failed:', e);
            }
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qsend-payment.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        // Fallback share (download) counts as share
        trackExpense(amount, activeLabel);
      }
    } catch (err) {
      console.error(err);
      setError('Sharing failed. Please try saving instead.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Gallery Actions ---

  const triggerShake = (id: string, callback: () => void) => {
    setShakingId(id);
    setTimeout(() => {
      setShakingId(null);
      callback();
    }, 400); 
  };

  const confirmSoftDelete = (id: string) => {
    setItemToDelete(id);
    setConfirmAction('deleteItem');
  };

  const handleConfirmAction = () => {
    if (confirmAction === 'deleteItem' && itemToDelete) {
        handleSoftDelete(itemToDelete);
    } else if (confirmAction === 'deleteAll') {
        handleDeleteAllData();
    } else if (confirmAction === 'emptyBin') {
        handleEmptyBin();
    } else if (confirmAction === 'resetExpenses') {
        handleResetExpenses();
    }
    setConfirmAction(null);
    setItemToDelete(null);
  };

  const handleSoftDelete = (id: string) => {
    triggerShake(id, () => {
      const updated = savedQRs.map(q => q.id === id ? { ...q, deletedAt: Date.now() } : q);
      setSavedQRs(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    });
  };

  const handleRestore = (id: string) => {
    const updated = savedQRs.map(q => q.id === id ? { ...q, deletedAt: undefined } : q);
    setSavedQRs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handlePermanentDelete = (id: string) => {
    triggerShake(id, () => {
      const updated = savedQRs.filter(q => q.id !== id);
      setSavedQRs(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    });
  };

  const handleEmptyBin = () => {
    const updated = savedQRs.filter(q => !q.deletedAt);
    setSavedQRs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setConfirmAction(null);
  };

  const handleDeleteAllData = () => {
    setSavedQRs([]);
    localStorage.removeItem(STORAGE_KEY);
    setConfirmAction(null);
  };

  const handleEditLabelStart = (e: React.MouseEvent, qr: QRData) => {
    e.stopPropagation();
    setEditingId(qr.id);
    setTempEditLabel(qr.label || '');
  };

  const handleEditLabelSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!tempEditLabel.trim()) return;
    const updated = savedQRs.map(q => q.id === id ? { ...q, label: tempEditLabel.trim() } : q);
    setSavedQRs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditingId(null);
  };

  const loadFromGallery = (qr: QRData) => {
    if (qr.deletedAt) return;
    setCurrentRawQR(qr.rawValue);
    setAmount(qr.amount || '');
    setSelectedThemeId(qr.themeId || THEMES[0].id);
    setCustomBackground(qr.customBackground || null);
    setCurrentQRId(qr.id);
    setQrLabel(qr.label || '');
    setView('editor');
  };

  // Filter for Gallery
  const filteredQRs = useMemo(() => {
    return savedQRs
      .filter(q => !q.deletedAt)
      .filter(q => q.label?.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [savedQRs, searchQuery]);

  // Filter for Recycle Bin
  const deletedQRs = useMemo(() => {
    return savedQRs
      .filter(q => !!q.deletedAt)
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  }, [savedQRs]);

  // --- Components ---

  const renderConfirmationModal = () => (
    <div className="absolute inset-0 z-[80] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in gpu">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[32px] p-8 shadow-2xl animate-scale-in flex flex-col items-center text-center border border-zinc-100 dark:border-zinc-800 gpu">
         <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500 animate-pulse-slow">
            <AlertTriangle size={32} />
         </div>
         <h3 className="text-xl font-display font-bold mb-3 text-zinc-900 dark:text-white tracking-tight">
           {confirmAction === 'deleteAll' ? 'Delete All Data?' 
            : confirmAction === 'deleteItem' ? 'Move to Recycle Bin?' 
            : confirmAction === 'resetExpenses' ? 'Reset Expenses?'
            : 'Empty Recycle Bin?'}
         </h3>
         <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm leading-relaxed px-2 font-medium">
           {confirmAction === 'deleteAll' 
             ? "This will permanently wipe all your saved QRs. This action is irreversible." 
             : confirmAction === 'deleteItem'
             ? "This QR will be moved to the recycle bin. You can restore it later."
             : confirmAction === 'resetExpenses'
             ? "This will clear all your expense tracking history. This cannot be undone."
             : "This will permanently delete all items in the recycle bin."}
         </p>
         <div className="flex gap-4 w-full">
            <button 
              onClick={() => { setConfirmAction(null); setItemToDelete(null); }} 
              className={`flex-1 h-12 rounded-xl font-semibold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-300 ${BTN_TAP}`}
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmAction}
              className={`flex-1 h-12 rounded-xl font-semibold text-sm bg-red-500 text-white shadow-lg shadow-red-500/20 ${BTN_TAP}`}
            >
              {confirmAction === 'deleteItem' ? 'Delete' : 'Confirm'}
            </button>
         </div>
      </div>
    </div>
  );

  const renderScanningOverlay = () => (
    <div className="absolute inset-0 bg-white/95 dark:bg-black/95 backdrop-blur-2xl z-[60] flex flex-col items-center justify-center animate-fade-in gpu">
      <div className="relative w-64 h-64 mb-10">
        <div className="absolute inset-0 border-2 border-zinc-100 dark:border-zinc-800 rounded-[32px]" />
        
        {/* Animated Scan Frame */}
        <div className="absolute inset-0 rounded-[32px] overflow-hidden">
             {/* Premium Laser Beam Scanner */}
             <div className="absolute left-0 right-0 h-32 bg-gradient-to-t from-indigo-500/30 to-transparent animate-scan z-10">
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,1)]" />
             </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
           {scanStatus === 'scanning' ? (
              <Smartphone size={48} className="text-zinc-300 dark:text-zinc-700 opacity-40 animate-pulse" />
           ) : (
             <div className="animate-scale-in flex flex-col items-center text-indigo-500">
               <CheckCircle2 size={80} className="fill-indigo-500 text-white dark:text-black shadow-xl rounded-full" />
             </div>
           )}
        </div>
      </div>
      <div className="text-center space-y-3 h-20 px-6">
        {scanStatus === 'scanning' ? (
          <>
            <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white animate-pulse-slow">Scanning...</h3>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Align QR code within the frame</p>
          </>
        ) : (
          <div className="animate-slide-up">
            <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">QR Detected</h3>
            <p className="text-indigo-500 font-bold">Processing payment details</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderCamera = () => (
    <div className="flex flex-col h-full bg-black relative animate-fade-in z-50 gpu">
       <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
         {!cameraError ? (
           <video 
             ref={videoRef} 
             className="w-full h-full object-cover opacity-80" 
             muted 
             playsInline
           />
         ) : (
            <div className="text-center px-8">
               <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
                  <Camera size={36} className="text-zinc-500" />
               </div>
               <h3 className="text-white font-display font-bold text-xl mb-3">Camera Access Needed</h3>
               <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Please enable camera permissions in your browser settings to scan QR codes directly.</p>
               <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
                 <button onClick={() => fileInputRef.current?.click()} className={`w-full px-8 py-4 bg-zinc-800 text-white font-bold rounded-2xl ${BTN_TAP}`}>Upload Image</button>
                 <button onClick={() => setView('home')} className={`w-full px-8 py-4 bg-white text-black font-bold rounded-2xl ${BTN_TAP}`}>Go Back</button>
               </div>
            </div>
         )}
       </div>
       
       {!cameraError && (
         <>
            <header className="absolute top-0 left-0 right-0 p-6 pt-safe z-50 flex justify-end">
               <button onClick={() => setView('home')} className="p-3 bg-black/40 backdrop-blur-xl rounded-full text-white hover:bg-black/60 transition-colors active:scale-90 ring-1 ring-white/10">
                  <X size={24} />
               </button>
            </header>
            
            {/* Viewfinder */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="w-72 h-72 border border-white/20 rounded-[40px] relative overflow-hidden backdrop-blur-[2px]">
                  {/* Premium Scanner Animation */}
                  <div className="absolute left-0 right-0 h-32 bg-gradient-to-t from-indigo-500/20 to-transparent animate-scan z-10">
                     <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,1)]" />
                  </div>
                  
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-[4px] border-l-[4px] border-white rounded-tl-[32px]" />
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-[4px] border-r-[4px] border-white rounded-tr-[32px]" />
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[4px] border-l-[4px] border-white rounded-bl-[32px]" />
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[4px] border-r-[4px] border-white rounded-br-[32px]" />
               </div>
            </div>

            <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none p-6 pb-safe">
               <p className="text-white/90 font-medium bg-black/50 backdrop-blur-xl inline-block px-6 py-3 rounded-full text-sm tracking-wide">Point camera at any UPI QR</p>
            </div>
         </>
       )}
    </div>
  );

  const renderSaveModal = () => (
    <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in gpu">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[40px] p-8 shadow-2xl animate-scale-in flex flex-col items-center text-center gpu ring-1 ring-white/20">
        {saveStep === 'confirm' && (
          <>
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
              <Save size={32} />
            </div>
            <h3 className="text-2xl font-display font-bold mb-3 tracking-tight">Save for later?</h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-10 leading-relaxed font-medium text-sm">
              Keep this QR in your gallery for quick access and payments.
            </p>
            <div className="flex flex-col w-full gap-4">
              <button onClick={handleConfirmSave} className={`w-full h-[60px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-premium ${BTN_TAP}`}>Save to Gallery</button>
              <button onClick={handleSkipSave} className={`w-full h-[60px] text-zinc-500 dark:text-zinc-400 font-semibold ${BTN_TAP}`}>No, just edit</button>
            </div>
          </>
        )}
        {saveStep === 'label' && (
          <>
            <div className="w-full flex items-center mb-8">
               <button onClick={() => setSaveStep('confirm')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white active:scale-90 transition-transform"><ArrowLeft size={24} /></button>
               <span className="flex-1 font-display font-bold text-xl pr-8">Name this QR</span>
            </div>
            <div className="w-full mb-10 relative">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 absolute left-4 -top-2.5 bg-white dark:bg-zinc-900 px-2">Label Name</label>
              <input 
                autoFocus 
                type="text" 
                value={qrLabel} 
                onChange={(e) => setQrLabel(e.target.value.slice(0, 30))} 
                placeholder="e.g. Home Rent" 
                className="w-full h-[72px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-2xl px-5 font-medium outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600 text-lg" 
              />
              <div className="text-right mt-2 text-xs font-bold text-zinc-300">{qrLabel.length}/30</div>
            </div>
            <button onClick={handleSaveLabelSubmit} disabled={!qrLabel.trim()} className={`w-full h-[64px] bg-indigo-600 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:scale-100 shadow-lg shadow-indigo-500/30 ${BTN_TAP}`}>Save Name</button>
          </>
        )}
        {saveStep === 'success' && (
          <div className="py-10 flex flex-col items-center animate-scale-in">
             <div className="w-20 h-20 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center mb-6 text-green-500 animate-bounce-sm"><Check size={40} strokeWidth={3} /></div>
             <h3 className="text-xl font-bold mb-2">Saved to Gallery</h3>
             <p className="text-zinc-400 font-medium">Ready to use</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderExpenses = () => {
    const { weekTotal, monthTotal, yearTotal } = getExpenseSummary();
    const { data, labels, type, max } = getGraphData();
    const recentExpenses = getRecentExpenses();
    const hasData = expenses.length > 0;

    return (
      <div className="space-y-6 pt-4 pb-2 animate-slide-up">
        {/* Interactive Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'week', label: 'This Week', value: weekTotal },
            { id: 'month', label: 'This Month', value: monthTotal },
            { id: 'year', label: 'This Year', value: yearTotal }
          ].map((item) => {
            const isActive = expenseView === item.id;
            return (
             <button 
               key={item.id} 
               onClick={() => setExpenseView(item.id as any)}
               className={`relative rounded-2xl p-3 text-center border transition-all duration-300 ${isActive ? 'bg-indigo-500 border-indigo-500 text-white shadow-md scale-[1.02]' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-white'} ${BTN_TAP}`}
             >
               <p className={`text-[10px] uppercase font-bold mb-1 tracking-wider ${isActive ? 'text-white/80' : 'text-zinc-400'}`}>{item.label}</p>
               <p className="text-sm font-bold truncate tracking-tighter">₹{item.value.toLocaleString()}</p>
             </button>
            );
          })}
        </div>

        {/* Graph Section */}
        {/* Updated: Remove overflow-hidden and add bottom padding to prevent label clipping */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl p-5 pb-8 border border-zinc-100 dark:border-zinc-800 relative">
          {hasData ? (
             <>
               <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-500" />
                    Spending Trend
                  </h4>
                  {/* Visual-only badge since cards control view now */}
                  <span className="px-3 py-1 bg-white dark:bg-zinc-900 rounded-lg text-[10px] font-bold uppercase text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                    {expenseView}
                  </span>
               </div>
               <ExpenseGraph data={data} labels={labels} type={type} max={max} />
             </>
          ) : (
             <div className="h-48 flex flex-col items-center justify-center text-zinc-400">
                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                   <BarChart3 size={20} className="opacity-50" />
                </div>
                <p className="text-xs font-semibold">No data for this period</p>
             </div>
          )}
        </div>
        
        {/* Recent History List */}
        {hasData && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl p-5 border border-zinc-100 dark:border-zinc-800">
             <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
                <Clock size={16} className="text-indigo-500" />
                Recent Activity
             </h4>
             <div className="space-y-3">
                {recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                           <Receipt size={18} />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[120px]">
                              {expense.label || 'Payment'}
                           </p>
                           <p className="text-[10px] text-zinc-400 font-semibold">
                              {new Date(expense.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                           </p>
                        </div>
                     </div>
                     <span className="text-sm font-bold text-zinc-900 dark:text-white">
                        ₹{expense.amount.toLocaleString()}
                     </span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Reset Button */}
        {hasData && (
          <button 
            onClick={() => setConfirmAction('resetExpenses')}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ${BTN_TAP}`}
          >
            <RefreshCw size={14} />
            Reset Expense Data
          </button>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-black animate-slide-up gpu">
      <div className="px-6 pt-8 pb-6 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-30 sticky top-0 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">Settings</h2>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto no-scrollbar pb-32">
        <section className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-4 px-2">Appearance</h3>
          <div className="bg-white dark:bg-zinc-900 rounded-[24px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-premium">
            <div className="flex items-center justify-between p-5">
               <div className="flex items-center gap-4">
                 <div className={`p-2.5 rounded-xl ${isDark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {isDark ? <Moon size={22} /> : <Sun size={22} />}
                 </div>
                 <span className="font-semibold text-lg">Dark Mode</span>
               </div>
               <button 
                 onClick={() => setIsDark(!isDark)}
                 className={`w-14 h-8 rounded-full transition-colors relative duration-300 ease-spring ${isDark ? 'bg-indigo-600' : 'bg-zinc-200'}`}
               >
                 <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ease-spring ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
               </button>
            </div>
          </div>
        </section>

        {/* Monthly Expenses Section */}
        <section className="animate-slide-up" style={{ animationDelay: '75ms' }}>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-4 px-2">Tracker</h3>
          <div className="bg-white dark:bg-zinc-900 rounded-[24px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-premium transition-all duration-500">
            <button 
               onClick={() => setIsExpensesOpen(!isExpensesOpen)}
               className={`w-full flex items-center justify-between p-5 ${BTN_TAP}`}
            >
               <div className="flex items-center gap-4">
                 <div className="p-2.5 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
                    <BarChart3 size={22} />
                 </div>
                 <span className="font-semibold text-lg">Monthly Expenses</span>
               </div>
               <ChevronDown size={20} className={`text-zinc-400 transition-transform duration-300 ${isExpensesOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Accordion Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-spring ${isExpensesOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="px-5 pb-5">
                {renderExpenses()}
              </div>
            </div>
          </div>
        </section>

        <section className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-4 px-2">Data Management</h3>
          <div className="bg-white dark:bg-zinc-900 rounded-[24px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-premium divide-y divide-zinc-100 dark:divide-zinc-800">
            
            <button 
              onClick={() => setView('recycleBin')}
              className={`w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${BTN_TAP}`}
            >
               <div className="flex items-center gap-4">
                 <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    <Trash2 size={22} />
                 </div>
                 <span className="font-semibold text-lg">Recycle Bin</span>
               </div>
               <div className="flex items-center gap-3 text-zinc-400">
                 {deletedQRs.length > 0 && <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">{deletedQRs.length}</span>}
                 <ChevronRight size={20} />
               </div>
            </button>

            <button 
              onClick={() => setConfirmAction('deleteAll')}
              className={`w-full flex items-center justify-between p-5 hover:bg-red-50 dark:hover:bg-red-900/10 group ${BTN_TAP}`}
            >
               <div className="flex items-center gap-4">
                 <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-500">
                    <AlertTriangle size={22} />
                 </div>
                 <span className="font-semibold text-lg text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300">Delete All Data</span>
               </div>
            </button>
          </div>
        </section>

        <div className="pt-8 text-center animate-fade-in" style={{ animationDelay: '200ms' }}>
           <p className="text-xs font-medium text-zinc-400">Qsend v1.0.0</p>
           <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-2">Local Storage • Secure • Offline</p>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-black p-6 animate-fade-in gpu">
        <header className="flex justify-between items-center mb-8 pt-safe">
           <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
                <Logo className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">
                Qsend
              </h1>
           </div>
           {/* Expense Ticker Mini */}
           <button onClick={() => setView('settings')} className="bg-zinc-100 dark:bg-zinc-800 rounded-full px-4 py-2 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
               ₹{getExpenseSummary().monthTotal.toLocaleString()}
             </span>
           </button>
        </header>

        <div className="flex-1 flex flex-col justify-center gap-6 mb-20">
            {/* Scan Card */}
            <button 
              onClick={handleStartCamera}
              className={`relative h-48 w-full bg-indigo-600 rounded-[32px] p-6 flex flex-col justify-between overflow-hidden shadow-xl shadow-indigo-500/30 group ${BTN_TAP}`}
            >
               <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-30 transition-opacity">
                  <ScanLine size={120} />
               </div>
               <div className="z-10 bg-white/20 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center text-white">
                  <Camera size={24} />
               </div>
               <div className="z-10 text-left">
                  <h2 className="text-2xl font-display font-bold text-white mb-1">Scan QR</h2>
                  <p className="text-indigo-100 font-medium text-sm">Use camera to pay</p>
               </div>
            </button>

            {/* Upload Card */}
            <div className="relative h-40 w-full bg-white dark:bg-zinc-900 rounded-[32px] p-1 flex items-center shadow-premium border border-zinc-200 dark:border-zinc-800">
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-full rounded-[28px] flex flex-row items-center justify-between px-8 group ${BTN_TAP}`}
               >
                  <div className="flex flex-col items-start">
                     <h2 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-1">Upload Image</h2>
                     <p className="text-zinc-400 font-medium text-sm">From gallery</p>
                  </div>
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-110 transition-transform">
                     <ImageIcon size={28} />
                  </div>
               </button>
            </div>
        </div>
    </div>
  );

  const renderEditor = () => (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-950 animate-slide-up gpu">
       <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {/* Top Bar */}
          <div className="flex justify-between items-center p-6 pt-safe">
             <button onClick={() => setView('home')} className="p-3 bg-white dark:bg-zinc-800 rounded-full shadow-sm text-zinc-900 dark:text-white active:scale-90 transition-transform">
                <ArrowLeft size={20} />
             </button>
             <h3 className="font-display font-bold text-zinc-900 dark:text-white">Customize</h3>
             <div className="w-10" />
          </div>

          {/* Editor Area */}
          <div className="px-6 flex flex-col items-center">
             <div id="qr-card-preview" className="w-full max-w-[320px] mx-auto mb-8 transition-all duration-300 ease-spring hover:scale-[1.02]">
                <QRCard 
                  rawValue={currentRawQR} 
                  amount={amount} 
                  themeId={selectedThemeId}
                  customBackground={customBackground || undefined}
                  label={qrLabel || (currentQRId ? savedQRs.find(q => q.id === currentQRId)?.label : undefined)}
                />
             </div>

             {/* Controls */}
             <div className="w-full max-w-sm space-y-6">
                {/* Amount Input */}
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center">
                   <span className="pl-4 text-zinc-400 font-bold">₹</span>
                   <input 
                      type="number" 
                      inputMode="decimal"
                      placeholder="Enter Amount"
                      value={amount}
                      onChange={(e) => {
                          if (e.target.value.length <= 8) setAmount(e.target.value);
                      }}
                      className="w-full h-12 bg-transparent px-2 font-display font-bold text-xl text-zinc-900 dark:text-white outline-none placeholder:text-zinc-300"
                   />
                </div>

                {/* Themes */}
                <div>
                   <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-2">Theme</h4>
                   <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x px-1">
                      {/* Upload Button */}
                      <div className="snap-start shrink-0">
                         <input 
                           type="file" 
                           ref={bgInputRef} 
                           accept="image/*" 
                           onChange={handleBackgroundUpload} 
                           className="hidden" 
                         />
                         <button 
                            onClick={() => bgInputRef.current?.click()}
                            className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:border-indigo-500 transition-colors"
                         >
                            <ImagePlus size={20} />
                         </button>
                      </div>

                      {THEMES.map(theme => (
                         <button 
                            key={theme.id}
                            onClick={() => { setSelectedThemeId(theme.id); setCustomBackground(null); }}
                            className={`snap-start shrink-0 w-12 h-12 rounded-full border-2 transition-all ${selectedThemeId === theme.id && !customBackground ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ 
                               background: theme.type === 'image' ? `url(${theme.value}) center/cover` : theme.value 
                            }}
                         />
                      ))}
                   </div>
                </div>
             </div>
          </div>
       </div>

       {/* Floating Action Bar */}
       <div className="absolute bottom-6 left-6 right-6 flex gap-4 z-20">
          <button 
             onClick={handleShare}
             disabled={isLoading}
             className={`flex-1 h-14 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 ${BTN_TAP}`}
          >
             {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Share2 size={20} /> Share</>}
          </button>
          <button 
             onClick={handleSaveToGallery}
             className={`h-14 w-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-bold shadow-premium flex items-center justify-center ${BTN_TAP}`}
          >
             <Save size={20} />
          </button>
       </div>
    </div>
  );

  const renderGallery = () => (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-black animate-slide-up gpu">
       <div className="px-6 pt-8 pb-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl sticky top-0 z-20">
          <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Gallery</h2>
          <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
             <input 
                type="text" 
                placeholder="Search saved QRs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl pl-11 pr-4 font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
             />
          </div>
       </div>

       <div className="flex-1 overflow-y-auto no-scrollbar p-6 pt-2 pb-32">
          {filteredQRs.length > 0 ? (
             <div className="grid grid-cols-2 gap-4">
                {filteredQRs.map(qr => (
                   <div 
                      key={qr.id} 
                      onClick={() => loadFromGallery(qr)}
                      className={`relative aspect-[4/5] rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden group cursor-pointer ${shakingId === qr.id ? 'animate-shake' : ''} ${BTN_TAP}`}
                   >
                      {/* Scaled Preview of the Actual Card */}
                      <div className="absolute inset-0 pointer-events-none transform scale-50 origin-top-left w-[200%] h-[200%]">
                         <QRCard 
                            rawValue={qr.rawValue}
                            amount={qr.amount || ''}
                            themeId={qr.themeId || THEMES[0].id}
                            label={qr.label}
                            customBackground={qr.customBackground}
                         />
                      </div>
                      
                      {/* Overlay Gradient for Text Readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                      
                      {/* Content */}
                      <div className="absolute inset-0 p-4 flex flex-col justify-end text-white pointer-events-none">
                         <div className="flex justify-between items-end">
                            <div className="flex-1 min-w-0">
                               {editingId === qr.id ? (
                                  <input 
                                     autoFocus
                                     value={tempEditLabel}
                                     onChange={(e) => setTempEditLabel(e.target.value)}
                                     onClick={(e) => e.stopPropagation()}
                                     onBlur={(e) => handleEditLabelSave(e as any, qr.id)}
                                     onKeyDown={(e) => e.key === 'Enter' && handleEditLabelSave(e as any, qr.id)}
                                     className="w-full bg-black/40 rounded px-1 py-0.5 text-sm font-bold outline-none border border-white/30 pointer-events-auto"
                                  />
                               ) : (
                                  <h4 className="font-bold truncate text-sm leading-tight shadow-black drop-shadow-md">
                                     {qr.label}
                                  </h4>
                               )}
                               <p className="text-[10px] opacity-80 mt-1">{new Date(qr.createdAt).toLocaleDateString()}</p>
                            </div>
                         </div>
                      </div>

                      {/* Actions */}
                      <div className="absolute top-2 right-2 flex gap-2 opacity-100 transition-opacity pointer-events-auto">
                         <button 
                            onClick={(e) => handleEditLabelStart(e, qr)}
                            className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/40 text-white"
                         >
                            <Edit2 size={14} />
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); confirmSoftDelete(qr.id); }}
                            className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-red-500/80 text-white"
                         >
                            <Trash2 size={14} />
                         </button>
                      </div>
                   </div>
                ))}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <Grid size={48} className="mb-4 opacity-20" />
                <p className="font-medium">No QRs found</p>
             </div>
          )}
       </div>
    </div>
  );

  const renderCropper = () => (
    <div className="flex flex-col h-full bg-black animate-fade-in z-50 gpu">
       <div className="relative flex-1 bg-black overflow-hidden">
         {cropImage && (
            <Cropper
               image={cropImage}
               crop={crop}
               zoom={zoom}
               aspect={1}
               onCropChange={setCrop}
               onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
               onZoomChange={setZoom}
               objectFit="contain"
               restrictPosition={false}
            />
         )}
       </div>
       <div className="p-6 bg-zinc-900 pb-safe space-y-6">
          <div className="flex items-center gap-4">
             <span className="text-xs font-bold text-zinc-500">ZOOM</span>
             <input 
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
             />
          </div>
          <div className="flex gap-4">
             <button onClick={() => { setView('home'); setCropImage(null); }} className="flex-1 h-12 bg-zinc-800 text-white font-bold rounded-xl">Cancel</button>
             <button onClick={onCropConfirm} className="flex-1 h-12 bg-white text-black font-bold rounded-xl">Crop & Scan</button>
          </div>
       </div>
    </div>
  );

  const renderRecycleBin = () => (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-black animate-slide-up gpu">
       <div className="px-6 pt-8 pb-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl sticky top-0 z-20 border-b border-zinc-200/50 dark:border-zinc-800/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <button onClick={() => setView('settings')} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white">
                <ArrowLeft size={24} />
             </button>
             <h2 className="text-2xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">Recycle Bin</h2>
          </div>
          {deletedQRs.length > 0 && (
             <button onClick={() => setConfirmAction('emptyBin')} className="text-xs font-bold text-red-500 px-3 py-1.5 bg-red-50 dark:bg-red-900/10 rounded-lg">
                Empty All
             </button>
          )}
       </div>

       <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-32">
          {deletedQRs.length > 0 ? (
             <div className="space-y-3">
                {deletedQRs.map(qr => (
                   <div key={qr.id} className={`flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm ${shakingId === qr.id ? 'animate-shake' : ''}`}>
                      <div className="flex items-center gap-4 overflow-hidden">
                         <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <Trash2 size={20} />
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-bold text-zinc-900 dark:text-white truncate">{qr.label}</h4>
                            <p className="text-xs text-zinc-400">Deleted {qr.deletedAt ? new Date(qr.deletedAt).toLocaleDateString() : ''}</p>
                         </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                         <button onClick={() => handleRestore(qr.id)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full" title="Restore">
                            <RotateCcw size={18} />
                         </button>
                         <button onClick={() => handlePermanentDelete(qr.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full" title="Delete Forever">
                            <X size={18} />
                         </button>
                      </div>
                   </div>
                ))}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <Trash2 size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Bin is empty</p>
             </div>
          )}
       </div>
    </div>
  );

  const BottomNav = () => {
    if (view === 'editor' || view === 'cropper' || view === 'camera') return null;

    const navItems = [
      { id: 'home', icon: Home, label: 'Home' },
      { id: 'gallery', icon: Grid, label: 'Gallery' },
      { id: 'settings', icon: SettingsIcon, label: 'Settings' }
    ];

    return (
       <div className="absolute bottom-6 left-6 right-6 h-16 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-[24px] shadow-2xl flex items-center justify-around px-2 z-40 border border-white/20 dark:border-zinc-800/50">
          {navItems.map(item => {
             const isActive = view === item.id;
             const Icon = item.icon;
             return (
                <button
                   key={item.id}
                   onClick={() => setView(item.id as ViewState)}
                   className={`relative flex flex-col items-center justify-center w-16 h-full transition-all duration-300 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}
                >
                   <Icon size={24} className={`transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                   <span className={`absolute bottom-2 text-[10px] font-bold transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                      {item.label}
                   </span>
                   {isActive && <div className="absolute -bottom-[1px] w-8 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
             );
          })}
       </div>
    );
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-950 transition-colors duration-500 overflow-hidden`}>
      <div className="w-full max-w-[420px] h-[100dvh] bg-zinc-50 dark:bg-black relative overflow-hidden shadow-2xl sm:rounded-[40px] flex flex-col gpu ring-1 ring-black/5 dark:ring-white/5">
        <div className="h-safe-top w-full shrink-0 bg-transparent" />
        
        {/* Global Hidden Input for Uploads - Available in all views */}
        <input 
          type="file" 
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {view === 'home' && renderHome()}
          {view === 'editor' && renderEditor()}
          {view === 'gallery' && renderGallery()}
          {view === 'cropper' && renderCropper()}
          {view === 'camera' && renderCamera()}
          {view === 'settings' && renderSettings()}
          {view === 'recycleBin' && renderRecycleBin()}
        </main>
        
        <BottomNav />
        {isScanning && renderScanningOverlay()}
        {showSaveModal && renderSaveModal()}
        {confirmAction && renderConfirmationModal()}
        
        {/* Floating Error Toast */}
        {error && !cropImage && !isScanning && (
          <div className="absolute top-6 left-6 right-6 z-[100] animate-slide-up pointer-events-none">
             <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                <AlertTriangle size={20} className="shrink-0" />
                <p className="text-sm font-semibold leading-snug">{error}</p>
             </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && !isScanning && !showSaveModal && (
          <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in pointer-events-none">
             <div className="flex flex-col items-center">
               <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
               <p className="text-zinc-900 dark:text-white font-bold text-sm tracking-wide">Processing...</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;