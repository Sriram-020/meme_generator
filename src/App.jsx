import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as htmlToImage from 'html-to-image';
import download from 'downloadjs';
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

    // Custom Editor State (Photoshop-like controls)
    const [canvasSize, setCanvasSize] = useState({ width: 500, height: 500 });
    const [imageTransform, setImageTransform] = useState({
        scale: 100, x: 0, y: 0, rotate: 0, flipH: false, flipV: false
    });
    const [imageFilters, setImageFilters] = useState({
        brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0
    });

    const [activeTool, setActiveTool] = useState('adjust'); // 'adjust', 'filters', 'transform'

    // Text State
    const [texts, setTexts] = useState(DEFAULT_TEXTS);

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
        setMode(newMode);
        // Reset texts
        setTexts(DEFAULT_TEXTS);
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

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setManualImage(reader.result);
                handleTabChange('custom');
                resetEditor();
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUrlSubmit = () => {
        if (manualUrl) {
            setManualImage(manualUrl);
            handleTabChange('custom');
            setManualUrl('');
            resetEditor();
        }
    };

    const handleAddToCustom = (meme) => {
        setManualImage(meme.url);
        handleTabChange('custom');
        resetEditor();
    };

    const resetEditor = () => {
        setCanvasSize({ width: 500, height: 500 });
        setImageTransform({ scale: 100, x: 0, y: 0, rotate: 0, flipH: false, flipV: false });
        setImageFilters({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0 });
    };

    const getCurrentLikeness = () => {
        if (mode === 'local') {
            const reaction = LOCAL_REACTIONS.find(r => r.id === localMood) || LOCAL_REACTIONS[0];
            return reaction.src;
        } else if (mode === 'custom') {
            return manualImage || '/default.jpg';
        } else {
            return selectedMeme ? selectedMeme.url : '/default.jpg';
        }
    };

    const handleRandomize = () => {
        handleTabChange('online');
        if (allOnlineMemes.length > 0) {
            const randomMeme = allOnlineMemes[Math.floor(Math.random() * allOnlineMemes.length)];
            setSelectedMeme(randomMeme);
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

    const currentImageSrc = getCurrentLikeness();

    const getImageStyle = () => {
        const baseStyle = { width: '100%', height: 'auto' };

        if (mode === 'custom') {
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
        if (mode === 'custom') {
            return {
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                minWidth: 'auto',
                maxWidth: 'none',
                background: '#fff' // Default canvas bg
            };
        }
        return {};
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
                                <AnimatePresence mode='wait'>
                                    <motion.img
                                        key={currentImageSrc}
                                        src={currentImageSrc}
                                        alt="Meme"
                                        className="meme-target"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        crossOrigin="anonymous"
                                        style={getImageStyle()}
                                    />
                                </AnimatePresence>
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
                                        <button key={reaction.id} onClick={() => setLocalMood(reaction.id)} className={`grid-btn ${localMood === reaction.id ? 'active' : ''}`}>
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
                                        <div key={`${meme.id}-${index}`} className={`list-item ${selectedMeme?.id === meme.id ? 'active' : ''}`} onClick={() => setSelectedMeme(meme)}>
                                            <span className="rank">#{index + 1}</span>
                                            <img src={meme.url} alt={meme.name} />
                                            <div className="item-meta">
                                                <span className="truncate">{meme.name}</span>
                                                <button className="link-btn" onClick={(e) => { e.stopPropagation(); handleAddToCustom(meme); }}>Edit in Studio &rarr;</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="full-width-btn primary" onClick={handleRandomize}>🎲 Randomize</button>
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
                                            <div className="control-group-box">
                                                <label>Upload Image</label>
                                                <input type="file" className="file-input" accept="image/*" onChange={handleFileUpload} />
                                                <div className="or-divider">OR</div>
                                                <div className="flex-row">
                                                    <input type="text" placeholder="Image URL..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} />
                                                    <button onClick={handleUrlSubmit}>Go</button>
                                                </div>
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
