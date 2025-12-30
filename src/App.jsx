import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as htmlToImage from 'html-to-image';
import download from 'downloadjs';
import { ResizableImage } from './components/ResizableImage';
import './App.css';

// Config
const IMGFLIP_API = 'https://api.imgflip.com/get_memes';
const BATCH_SIZE = 20;

const FONTS = [
    { name: 'Impact', val: 'Impact' },
    { name: 'Arial', val: 'Arial' },
    { name: 'Comic Sans', val: '"Comic Sans MS", cursive' },
    { name: 'Montserrat', val: '"Montserrat", sans-serif' },
    { name: 'Courier', val: 'Courier New' },
    { name: 'Verdana', val: 'Verdana, sans-serif' },
    { name: 'Times New Roman', val: '"Times New Roman", serif' }
];

const LOCAL_REACTIONS = [
    { id: 'neutral', label: '😐 Dr. Diwakar', src: '/default.jpg' },
    { id: 'happy', label: '😂 Happy', src: '/happy.png' },
    { id: 'angry', label: '😡 Angry', src: '/angry.png' },
    { id: 'sad', label: '😭 Sad', src: '/sad.png' },
    { id: 'shocked', label: '😱 Shock', src: '/shocked.png' },
    { id: 'cool', label: '😎 Cool', src: '/cool.png' },
    { id: 'confused', label: '😵 Confused', src: '/confused.png' }
];

const DEFAULT_TEXTS = [
    {
        id: 1,
        content: 'TOP TEXT',
        x: 0,
        y: -140,
        color: '#ffffff',
        fontSize: 40,
        fontWeight: 'bold',
        fontStyle: 'normal',
        fontFamily: 'Impact',
        stroke: true
    },
    {
        id: 2,
        content: 'BOTTOM TEXT',
        x: 0,
        y: 140,
        color: '#ffffff',
        fontSize: 40,
        fontWeight: 'bold',
        fontStyle: 'normal',
        fontFamily: 'Impact',
        stroke: true
    }
];

function App() {
    const [mode, setMode] = useState('local'); // 'local', 'online', 'custom'
    const [localMood, setLocalMood] = useState('neutral');

    // Online Memes State
    const [allOnlineMemes, setAllOnlineMemes] = useState([]);
    const [filteredMemes, setFilteredMemes] = useState([]);
    const [visibleMemes, setVisibleMemes] = useState([]);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [downloadFormat, setDownloadFormat] = useState('png');
    const [searchQuery, setSearchQuery] = useState('');

    // Manual Input State
    const [manualImage, setManualImage] = useState(null);
    const [manualUrl, setManualUrl] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Custom Editor State (Photoshop-like controls)
    const [canvasSize, setCanvasSize] = useState({ width: 500, height: 500 });
    const [imageTransform, setImageTransform] = useState({
        scale: 100, x: 0, y: 0, rotate: 0, flipH: false, flipV: false
    });
    const [imageFilters, setImageFilters] = useState({
        brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0
    });

    const [activeTool, setActiveTool] = useState('adjust'); // 'adjust', 'filters', 'transform'

    // CUSTOM LAYERS (New feature: Multiple images)
    const [customLayers, setCustomLayers] = useState([]);
    const [selectedLayerId, setSelectedLayerId] = useState(null);

    // Single Layer State (For Local/Online modes to support resizing)
    const [singleLayerAttrs, setSingleLayerAttrs] = useState(null);

    // My Saved Templates
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [savedId, setSavedId] = useState(null);

    // Text State
    const [texts, setTexts] = useState(DEFAULT_TEXTS);
    const [savedTexts, setSavedTexts] = useState({});
    const [customId, setCustomId] = useState(Date.now());

    const getContextKey = (m, l, o, c, s) => {
        if (m === 'local') return `local-${l}`;
        if (m === 'online') return `online-${o?.id || 'null'}`;
        if (m === 'custom') return `custom-${c}`;
        if (m === 'saved') return `saved-${s}`;
        return 'unknown';
    };

    const changeContext = ({ nextMode, nextLocal, nextMeme, nextCustomId, nextSavedId }) => {
        // Defaults
        const nMode = nextMode !== undefined ? nextMode : mode;
        const nLocal = nextLocal !== undefined ? nextLocal : localMood;
        const nMeme = nextMeme !== undefined ? nextMeme : selectedMeme;
        const nCustomId = nextCustomId !== undefined ? nextCustomId : customId;
        const nSavedId = nextSavedId !== undefined ? nextSavedId : savedId;

        // 1. Save Current
        const currentKey = getContextKey(mode, localMood, selectedMeme, customId, savedId);
        const updatedSaved = { ...savedTexts, [currentKey]: texts };
        setSavedTexts(updatedSaved);

        // 2. Set States
        if (nextMode !== undefined && nextMode !== mode) setMode(nextMode);
        if (nextLocal !== undefined && nextLocal !== localMood) setLocalMood(nextLocal);
        if (nextMeme !== undefined && nextMeme !== selectedMeme) setSelectedMeme(nextMeme);
        if (nextCustomId !== undefined && nextCustomId !== customId) setCustomId(nextCustomId);
        if (nextSavedId !== undefined && nextSavedId !== savedId) setSavedId(nextSavedId);

        // 3. Load New
        const nextKey = getContextKey(nMode, nLocal, nMeme, nCustomId, nSavedId);
        setTexts(updatedSaved[nextKey] || DEFAULT_TEXTS);
    };

    const getCurrentLikeness = () => {
        if (mode === 'local') {
            const reaction = LOCAL_REACTIONS.find(r => r.id === localMood) || LOCAL_REACTIONS[0];
            return reaction.src;
        } else if (mode === 'saved') {
            const template = savedTemplates.find(t => t.id === savedId);
            return template ? template.src : '/default.jpg';
        } else if (mode === 'custom') {
            return manualImage || '/default.jpg';
        } else {
            return selectedMeme ? selectedMeme.url : '/default.jpg';
        }
    };

    const currentImageSrc = getCurrentLikeness();

    const memeRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        fetch(IMGFLIP_API)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const memes = data.data.memes;
                    setAllOnlineMemes(memes);
                    setFilteredMemes(memes);
                    setVisibleMemes(memes.slice(0, BATCH_SIZE));
                    if (memes.length > 0) setSelectedMeme(memes[0]);
                }
            })
            .catch(err => console.error("Failed to fetch memes", err));
    }, []);

    // Effect: Handle resizing capabilities for Local/Online/Saved modes
    useEffect(() => {
        if (mode === 'custom') return;

        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;

            // Constrain MAX size to prevent "zooming" / overflow issues
            const MAX_DIM = 800;
            let finalW = w;
            let finalH = h;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = w / h;
                if (w > h) {
                    finalW = MAX_DIM;
                    finalH = MAX_DIM / ratio;
                } else {
                    finalH = MAX_DIM;
                    finalW = MAX_DIM * ratio;
                }
            }

            setCanvasSize({ width: finalW, height: finalH });
            setSingleLayerAttrs({
                x: 0, y: 0, width: finalW, height: finalH, rotate: 0
            });
            setSelectedLayerId('single-main');
        };
        img.src = currentImageSrc;
    }, [currentImageSrc, mode]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredMemes(allOnlineMemes);
            setVisibleMemes(allOnlineMemes.slice(0, BATCH_SIZE));
        } else {
            const lowerQ = searchQuery.toLowerCase();
            const filtered = allOnlineMemes.filter(meme => meme.name.toLowerCase().includes(lowerQ));
            setFilteredMemes(filtered);
            setVisibleMemes(filtered.slice(0, BATCH_SIZE));
        }
    }, [searchQuery, allOnlineMemes]);

    const handleTabChange = (newMode) => {
        changeContext({ nextMode: newMode });
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollTop + clientHeight >= scrollHeight - 50) {
            const currentLength = visibleMemes.length;
            let nextBatch = [];

            if (currentLength < filteredMemes.length) {
                nextBatch = filteredMemes.slice(currentLength, currentLength + BATCH_SIZE);
            } else if (searchQuery === '') {
                const loopIndex = currentLength % filteredMemes.length;
                nextBatch = filteredMemes.slice(loopIndex, loopIndex + BATCH_SIZE);
            }

            if (nextBatch.length > 0) {
                setVisibleMemes(prev => [...prev, ...nextBatch]);
            }
        }
    };

    const addCustomLayer = (src, dims = null) => {
        const newLayer = {
            id: Date.now(),
            src: src,
            x: dims ? 0 : 50,
            y: dims ? 0 : 50,
            width: dims ? dims.width : 200,
            height: dims ? dims.height : 200,
            rotate: 0
        };
        setCustomLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
    };

    const updateCustomLayer = (id, newAttrs) => {
        setCustomLayers(prev => prev.map(l => l.id === id ? { ...l, ...newAttrs } : l));
    };

    const removeCustomLayer = (id) => {
        setCustomLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) setSelectedLayerId(null);
    };

    const processNewImage = (src) => {
        const img = new Image();
        img.onload = () => {
            const dims = { width: img.naturalWidth, height: img.naturalHeight };

            // Constrain Size
            const MAX_DIM = 800;
            if (dims.width > MAX_DIM || dims.height > MAX_DIM) {
                const ratio = dims.width / dims.height;
                if (dims.width > dims.height) {
                    dims.width = MAX_DIM;
                    dims.height = MAX_DIM / ratio;
                } else {
                    dims.height = MAX_DIM;
                    dims.width = MAX_DIM * ratio;
                }
            }

            // If this is the FIRST layer (or we are starting custom mode fresh), resize canvas
            // We check if mode is NOT custom yet, OR if customLayers is empty
            const isFirst = mode !== 'custom' || customLayers.length === 0;

            if (isFirst) {
                // Resize Canvas
                setCanvasSize({ width: dims.width, height: dims.height });
                // Switch mode
                if (mode !== 'custom') {
                    changeContext({ nextMode: 'custom', nextCustomId: Date.now() });
                }
                // Add as base layer (full size at 0,0)
                const newId = Date.now();
                setCustomLayers([{
                    id: newId,
                    src: src,
                    x: 0, y: 0,
                    width: dims.width,
                    height: dims.height,
                    rotate: 0
                }]);
                setSelectedLayerId(newId);
            } else {
                // Just add as new layer (maybe scale down if huge?)
                // For now, let's add it at original size but offset
                addCustomLayer(src, dims);
            }
            resetEditor(false); // Don't reset canvas size if we just set it
        };
        img.src = src;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                processNewImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUrlSubmit = () => {
        if (manualUrl) {
            processNewImage(manualUrl);
            setManualUrl('');
        }
    };

    const handleAddToCustom = (item) => {
        // Handle both online memes (url) and saved templates (src)
        const src = item.url || item.src;
        if (src) processNewImage(src);
    };

    const handleAIGenerate = () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        // Use pollinations.ai for free generation
        const prompt = encodeURIComponent(aiPrompt);
        const url = `https://image.pollinations.ai/prompt/${prompt}?width=800&height=800&nologo=true`;

        // Pre-fetch to ensure it loads
        const img = new Image();
        img.onload = () => {
            setIsGenerating(false);
            processNewImage(url);
            setAiPrompt('');
        };
        img.onerror = () => {
            setIsGenerating(false);
            alert('Failed to generate image. Please try a different prompt.');
        };
        img.src = url;
    };

    const resetEditor = (resetCanvas = true) => {
        if (resetCanvas) setCanvasSize({ width: 500, height: 500 });
        setImageTransform({ scale: 100, x: 0, y: 0, rotate: 0, flipH: false, flipV: false });
        setImageFilters({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0 });
    };



    const handleRandomize = () => {
        if (allOnlineMemes.length > 0) {
            const randomMeme = allOnlineMemes[Math.floor(Math.random() * allOnlineMemes.length)];
            changeContext({ nextMode: 'online', nextMeme: randomMeme });
        } else {
            changeContext({ nextMode: 'online' });
        }
    };

    const handleDownload = async () => {
        if (!memeRef.current) return;
        try {
            let dataUrl;
            const options = { backgroundColor: null };

            if (mode === 'custom') {
                options.width = canvasSize.width;
                options.height = canvasSize.height;
            }

            if (downloadFormat === 'jpeg') {
                dataUrl = await htmlToImage.toJpeg(memeRef.current, { ...options, quality: 0.95, backgroundColor: '#fff' });
            } else if (downloadFormat === 'svg') {
                dataUrl = await htmlToImage.toSvg(memeRef.current, options);
            } else {
                dataUrl = await htmlToImage.toPng(memeRef.current, options);
            }
            const ext = downloadFormat === 'sticker' ? 'png' : downloadFormat;
            download(dataUrl, `meme-gen-ultimate.${ext}`);
        } catch (error) {
            console.error('Download failed', error);
        }
    };

    const handleSaveTemplate = (src, label) => {
        const newTemplate = {
            id: Date.now(),
            src: src,
            label: label || `Template ${savedTemplates.length + 1}`
        };
        setSavedTemplates(prev => [newTemplate, ...prev]);

        // Optionally switch to it immediately
        // changeContext({ nextMode: 'saved', nextSavedId: newTemplate.id });
    };

    const handleSaveCanvasAsTemplate = async () => {
        if (!memeRef.current) return;
        try {
            // Temporarily hide handles? Not easily possible without state, but usually handles are external to 'memeRef' content if we structure right.
            // Currently handles are inside 'meme-boundary' if layers are selected. 
            // We should ideally deselect everything before snapshotting so no borders appear.
            const oldSelection = selectedLayerId;
            setSelectedLayerId(null);

            // Wait a tick for react to re-render clean state
            setTimeout(async () => {
                const dataUrl = await htmlToImage.toPng(memeRef.current, { backgroundColor: '#fff' });
                handleSaveTemplate(dataUrl, `Studio Create ${new Date().toLocaleTimeString()}`);
                setSelectedLayerId(oldSelection); // restore selection
            }, 100);
        } catch (err) {
            console.error(err);
        }
    };

    // Text Handlers
    const addTextLayer = () => {
        const newId = Math.max(...texts.map(t => t.id), 0) + 1;
        setTexts([...texts, {
            id: newId, content: 'TEXT', x: 0, y: 0, color: '#ffffff', fontSize: 32,
            fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Impact', stroke: true
        }]);
    };

    const updateText = (id, key, value) => {
        setTexts(texts.map(t => t.id === id ? { ...t, [key]: value } : t));
    };

    const toggleTextProp = (id, prop) => {
        setTexts(texts.map(t => {
            if (t.id !== id) return t;
            if (prop === 'fontWeight') return { ...t, fontWeight: t.fontWeight === 'bold' ? 'normal' : 'bold' };
            if (prop === 'fontStyle') return { ...t, fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' };
            if (prop === 'stroke') return { ...t, stroke: !t.stroke };
            return t;
        }));
    }

    const removeText = (id) => {
        setTexts(texts.filter(t => t.id !== id));
    };



    const getImageStyle = () => {
        const baseStyle = { width: '100%', height: 'auto' };

        if (mode === 'custom') {
            // In custom mode with layers, the "base" image is just for fallback or reference if needed, 
            // but we primarily use layers. 
            // However, to keep backward compat if customLayers is empty, we show manualImage.
            if (customLayers.length > 0) return { display: 'none' }; // Hide base if layers exist

            baseStyle.width = '100%';
            baseStyle.height = '100%';
            baseStyle.objectFit = 'contain';
            baseStyle.transform = `
            translate(${imageTransform.x}px, ${imageTransform.y}px) 
            scale(${imageTransform.scale / 100}) 
            rotate(${imageTransform.rotate}deg)
            scaleX(${imageTransform.flipH ? -1 : 1})
            scaleY(${imageTransform.flipV ? -1 : 1})
        `;
            baseStyle.filter = `
            brightness(${imageFilters.brightness}%)
            contrast(${imageFilters.contrast}%)
            saturate(${imageFilters.saturate}%)
            grayscale(${imageFilters.grayscale}%)
            sepia(${imageFilters.sepia}%)
            hue-rotate(${imageFilters.hue}deg)
            blur(${imageFilters.blur}px)
        `;
            // Ensure origin is center for predictable transforms
            baseStyle.transformOrigin = 'center';
        }
        return baseStyle;
    };

    const getBoundaryStyle = () => {
        // Apply canvas size in ALL modes now
        return {
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            minWidth: 'auto',
            maxWidth: 'none',
            background: '#fff', // Default canvas bg
            display: 'block' // Ensure it's not flex centering children weirdly if we want absolute positioning
        };
    };

    return (
        <div className="app-root">

            {/* 1. APP BAR */}
            <header className="app-bar">
                <div className="logo-section">
                    <span className="logo-icon">🍉</span>
                    <h1 className="app-name">WatermelonStar <span className="pro-badge">PRO</span></h1>
                </div>
                <div className="app-actions">
                    <button className="icon-btn" title="Reset All" onClick={resetEditor}>↺</button>
                    <button className="cta-btn safe-action" onClick={handleDownload}>Download</button>
                </div>
            </header>

            {/* 2. NAV BAR (Sub-header) */}
            <nav className="nav-bar">
                <button className={`nav-item ${mode === 'local' ? 'active' : ''}`} onClick={() => handleTabChange('local')}>
                    Dr. Diwakar
                </button>
                <button className={`nav-item ${mode === 'online' ? 'active' : ''}`} onClick={() => handleTabChange('online')}>
                    Online Gallery
                </button>
                <button className={`nav-item ${mode === 'saved' ? 'active' : ''}`} onClick={() => handleTabChange('saved')}>
                    My Templates
                </button>
                <button className={`nav-item ${mode === 'custom' ? 'active' : ''}`} onClick={() => handleTabChange('custom')}>
                    Studio Editor
                </button>
            </nav>

            <div className="main-workspace">

                {/* LEFT PANEL: PREVIEW CANVAS */}
                <div className="preview-stage">
                    <div className="canvas-wrapper">
                        <div className="meme-boundary" ref={memeRef} style={getBoundaryStyle()}>
                            {texts.map((text) => (
                                <motion.div
                                    key={text.id}
                                    drag
                                    dragMomentum={false}
                                    dragConstraints={memeRef}
                                    initial={{ x: text.x, y: text.y }}
                                    className="draggable-text"
                                    style={{
                                        color: text.color,
                                        fontSize: `${text.fontSize}px`,
                                        fontWeight: text.fontWeight,
                                        fontStyle: text.fontStyle,
                                        fontFamily: text.fontFamily,
                                        textShadow: text.stroke ? `2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000` : 'none',
                                        zIndex: 10 + text.id,
                                        left: '50%', top: '50%',
                                        marginLeft: '-50px', marginTop: '-20px'
                                    }}
                                >
                                    {text.content}
                                </motion.div>
                            ))}

                            <div className="image-layer">
                                {mode === 'custom' && customLayers.map(layer => (
                                    <ResizableImage
                                        key={layer.id}
                                        {...layer}
                                        initialX={layer.x} initialY={layer.y}
                                        initialWidth={layer.width} initialHeight={layer.height}
                                        initialRotate={layer.rotate}
                                        isSelected={layer.id === selectedLayerId}
                                        onSelect={setSelectedLayerId}
                                        onChange={(newAttrs) => updateCustomLayer(layer.id, newAttrs)}
                                        onRemove={() => removeCustomLayer(layer.id)}
                                    />
                                ))}

                                {mode !== 'custom' && singleLayerAttrs && (
                                    <ResizableImage
                                        key="single-main"
                                        id="single-main"
                                        src={currentImageSrc}
                                        initialX={singleLayerAttrs.x} initialY={singleLayerAttrs.y}
                                        initialWidth={singleLayerAttrs.width} initialHeight={singleLayerAttrs.height}
                                        initialRotate={singleLayerAttrs.rotate}
                                        isSelected={selectedLayerId === 'single-main'}
                                        onSelect={setSelectedLayerId}
                                        onChange={(newAttrs) => setSingleLayerAttrs(prev => ({ ...prev, ...newAttrs }))}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="floating-tools">
                        <select className="pill-select" value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)}>
                            <option value="png">PNG (HQ)</option>
                            <option value="jpeg">JPG</option>
                            <option value="sticker">Sticker</option>
                            <option value="svg">SVG</option>
                        </select>
                    </div>
                </div>

                {/* RIGHT PANEL: TOOLS & PROPERTIES */}
                <aside className="properties-panel">

                    {/* DYNAMIC TOOLS BASED ON MODE */}
                    <div className="tools-scroll-area">

                        {mode === 'local' && (
                            <div className="panel-section">
                                <h3>Select Reaction</h3>
                                <div className="grid-selector">
                                    {LOCAL_REACTIONS.map(reaction => (
                                        <button key={reaction.id} onClick={() => changeContext({ nextLocal: reaction.id })} className={`grid-btn ${localMood === reaction.id ? 'active' : ''}`}>
                                            <img src={reaction.src} alt="" className="grid-thumb" />
                                            <span>{reaction.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mode === 'online' && (
                            <div className="panel-section">
                                <h3>Trending Memes</h3>
                                <div className="search-row">
                                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                                <div className="list-selector" onScroll={handleScroll} ref={scrollRef}>
                                    {visibleMemes.map((meme, index) => (
                                        <div key={`${meme.id}-${index}`} className={`list-item ${selectedMeme?.id === meme.id ? 'active' : ''}`} onClick={() => changeContext({ nextMeme: meme })}>
                                            <span className="rank">#{index + 1}</span>
                                            <img src={meme.url} alt={meme.name} />
                                            <div className="item-meta">
                                                <span className="truncate">{meme.name}</span>
                                                <div className="flex-row">
                                                    <button className="link-btn" onClick={(e) => { e.stopPropagation(); handleAddToCustom(meme); }}>Edit in Studio &rarr;</button>
                                                    <button className="link-btn" style={{ marginLeft: 10, color: '#fafafa' }} onClick={(e) => { e.stopPropagation(); handleSaveTemplate(meme.url, meme.name); }}>♥ Save</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="full-width-btn primary" onClick={handleRandomize}>🎲 Randomize</button>
                            </div>
                        )}

                        {mode === 'saved' && (
                            <div className="panel-section">
                                <h3>My Saved Templates</h3>
                                {savedTemplates.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                                        No saved templates yet. <br />
                                        <small>Save from Online Gallery or Studio.</small>
                                    </div>
                                ) : (
                                    <div className="grid-selector">
                                        {savedTemplates.map(tpl => (
                                            <div key={tpl.id} className={`grid-btn ${savedId === tpl.id ? 'active' : ''}`} onClick={() => changeContext({ nextSavedId: tpl.id })}>
                                                <img src={tpl.src} alt="" className="grid-thumb" />
                                                <span className="truncate" style={{ maxWidth: '100%' }}>{tpl.label}</span>
                                                <button
                                                    className="link-btn"
                                                    style={{ fontSize: '0.6rem', marginTop: 5, color: '#38bdf8' }}
                                                    onClick={(e) => { e.stopPropagation(); handleAddToCustom(tpl); }}
                                                >
                                                    Edit in Studio
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === 'custom' && (
                            <div className="panel-section studio-controls">
                                <div className="studio-tabs">
                                    <button className={`s-tab ${activeTool === 'adjust' ? 'active' : ''}`} onClick={() => setActiveTool('adjust')}>Adjust</button>
                                    <button className={`s-tab ${activeTool === 'filters' ? 'active' : ''}`} onClick={() => setActiveTool('filters')}>Filters</button>
                                    <button className={`s-tab ${activeTool === 'transform' ? 'active' : ''}`} onClick={() => setActiveTool('transform')}>Transform</button>
                                </div>

                                <div className="studio-body">
                                    {activeTool === 'adjust' && (
                                        <>
                                            <div className="control-group-box" style={{ background: 'linear-gradient(45deg, #2b1055, #7597de)', border: '1px solid #7928CA' }}>
                                                <label style={{ color: 'white', fontWeight: 'bold' }}>✨ AI Magic</label>
                                                <div className="flex-row">
                                                    <input
                                                        type="text"
                                                        placeholder="Describe a meme image..."
                                                        value={aiPrompt}
                                                        onChange={(e) => setAiPrompt(e.target.value)}
                                                        disabled={isGenerating}
                                                        style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
                                                    />
                                                    <button onClick={handleAIGenerate} disabled={isGenerating} style={{ background: 'white', color: '#2b1055' }}>
                                                        {isGenerating ? '...' : 'Gen'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="control-group-box">
                                                <label>Insert Assets</label>
                                                <div className="assets-scroller" style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5, marginBottom: 10 }}>
                                                    {LOCAL_REACTIONS.map(r => (
                                                        <img
                                                            key={r.id}
                                                            src={r.src}
                                                            title={r.label}
                                                            className="asset-thumb"
                                                            style={{ width: 40, height: 40, borderRadius: 4, cursor: 'pointer', border: '1px solid #475569' }}
                                                            onClick={() => addCustomLayer(r.src)}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex-row">
                                                    <select className="pill-select" style={{ width: '100%', background: '#1e293b', border: '1px solid #475569' }} onChange={(e) => { if (e.target.value) addCustomLayer(e.target.value); e.target.value = ""; }}>
                                                        <option value="">+ Insert Saved Template...</option>
                                                        {savedTemplates.map(t => (
                                                            <option key={t.id} value={t.src}>{t.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="control-group-box">
                                                <label>Upload Image</label>
                                                <input type="file" className="file-input" accept="image/*" onChange={handleFileUpload} />
                                                <div className="or-divider">OR</div>
                                                <div className="flex-row">
                                                    <input type="text" placeholder="Image URL..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} />
                                                    <button onClick={handleUrlSubmit}>Go</button>
                                                </div>
                                                <div className="or-divider" style={{ marginTop: 10 }}>ACTIONS</div>
                                                <button className="full-width-btn" style={{ background: '#3b82f6', color: 'white', marginTop: 5 }} onClick={handleSaveCanvasAsTemplate}>
                                                    Save Workspace as Template
                                                </button>
                                            </div>
                                            <div className="control-group-box">
                                                <label>Canvas Size</label>
                                                <div className="flex-row equal">
                                                    <input type="number" value={canvasSize.width} onChange={e => setCanvasSize({ ...canvasSize, width: +e.target.value })} placeholder="W" />
                                                    <span>×</span>
                                                    <input type="number" value={canvasSize.height} onChange={e => setCanvasSize({ ...canvasSize, height: +e.target.value })} placeholder="H" />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {activeTool === 'filters' && (
                                        <div className="filters-stack">
                                            {Object.keys(imageFilters).map(filter => (
                                                <div key={filter} className="slider-row">
                                                    <label>{filter.charAt(0).toUpperCase() + filter.slice(1)}</label>
                                                    <input
                                                        type="range"
                                                        min={filter === 'hue' ? 0 : filter === 'blur' ? 0 : 0}
                                                        max={filter === 'hue' ? 360 : filter === 'blur' ? 20 : 200}
                                                        value={imageFilters[filter]}
                                                        onChange={(e) => setImageFilters({ ...imageFilters, [filter]: +e.target.value })}
                                                    />
                                                    <span>{imageFilters[filter]}</span>
                                                </div>
                                            ))}
                                            <button className="reset-link" onClick={() => setImageFilters({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0 })}>Reset Filters</button>
                                        </div>
                                    )}

                                    {activeTool === 'transform' && (
                                        <div className="transform-stack">
                                            <div className="slider-row">
                                                <label>Scale (%)</label>
                                                <input type="range" min="10" max="300" value={imageTransform.scale} onChange={e => setImageTransform({ ...imageTransform, scale: +e.target.value })} />
                                            </div>
                                            <div className="slider-row">
                                                <label>Rotate (°)</label>
                                                <input type="range" min="0" max="360" value={imageTransform.rotate} onChange={e => setImageTransform({ ...imageTransform, rotate: +e.target.value })} />
                                            </div>
                                            <div className="flex-row padded">
                                                <button className={`toggle-btn ${imageTransform.flipH ? 'active' : ''}`} onClick={() => setImageTransform({ ...imageTransform, flipH: !imageTransform.flipH })}>↔ Flip H</button>
                                                <button className={`toggle-btn ${imageTransform.flipV ? 'active' : ''}`} onClick={() => setImageTransform({ ...imageTransform, flipV: !imageTransform.flipV })}>↕ Flip V</button>
                                            </div>
                                            <div className="slider-row">
                                                <label>Position X</label>
                                                <input type="range" min="-300" max="300" value={imageTransform.x} onChange={e => setImageTransform({ ...imageTransform, x: +e.target.value })} />
                                            </div>
                                            <div className="slider-row">
                                                <label>Position Y</label>
                                                <input type="range" min="-300" max="300" value={imageTransform.y} onChange={e => setImageTransform({ ...imageTransform, y: +e.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SHARED TEXT STUDIO */}
                        <div className="panel-section">
                            <div className="flex-row spaced">
                                <h3>Text Layers</h3>
                                <button className="small-btn" onClick={addTextLayer}>+ Add</button>
                            </div>
                            <div className="layers-container">
                                {texts.map((text) => (
                                    <div key={text.id} className="layer-card">
                                        <input type="text" value={text.content} onChange={(e) => updateText(text.id, 'content', e.target.value)} />
                                        <div className="layer-tools">
                                            <select value={text.fontFamily} onChange={(e) => updateText(text.id, 'fontFamily', e.target.value)}>
                                                {FONTS.map(f => <option key={f.name} value={f.val}>{f.name}</option>)}
                                            </select>
                                            <input type="color" value={text.color} onChange={(e) => updateText(text.id, 'color', e.target.value)} />
                                            <button className={text.stroke ? 'on' : ''} onClick={() => toggleTextProp(text.id, 'stroke')}>Stroke</button>
                                            <button className="delete-btn" onClick={() => removeText(text.id)}>×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    );
}

export default App;
