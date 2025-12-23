# Quick Start Guide

## 🚀 Running the Application

### Option 1: Direct File Open (Simplest)
1. Double-click `index.html`
2. Your browser will open the application
3. Allow camera access when prompted
4. Start using hand gestures!

### Option 2: Local Web Server (Recommended)
1. **Using PowerShell:**
   ```powershell
   .\serve.ps1
   ```

2. **Using Command Prompt:**
   ```cmd
   serve.bat
   ```

3. **Or manually with Python:**
   ```bash
   python -m http.server 8000
   ```

4. Open browser to: `http://localhost:8000`

## 👋 Using Hand Gestures

1. **Position your hand** in front of the camera
2. **Close your hand** → Particles contract and shrink
3. **Open your hand** → Particles expand, grow, and disperse
4. **Gradual transitions** → Smoothly open/close for fluid effects

## ⚙️ Controls

### UI Panel (Top Left)
- **Pattern**: Choose from 8 particle patterns
- **Color Picker**: Change particle colors
- **Particle Count**: 1,000 - 50,000 particles
- **Particle Size**: 1 - 10 pixels
- **Gesture Sensitivity**: Adjust responsiveness
- **Panel Toggle**: Click `−` to collapse

### Fullscreen
- Click the **⛶** button (bottom right) for fullscreen mode
- Press `ESC` to exit fullscreen

## 🎨 Available Patterns

1. **Sphere** - Classic ball shape
2. **Torus** - Donut shape
3. **Cube** - 3D cube volume
4. **Spiral** - Helical spiral
5. **Flower** - Petal pattern
6. **Wave** - Wavy surface
7. **Explosion** - Radial burst
8. **Galaxy** - Spiral galaxy

## 🔧 Troubleshooting

### Camera Not Working
- **Check permissions**: Ensure browser has camera access
- **Check camera**: Make sure no other app is using the camera
- **Refresh**: Try refreshing the page and allow access again

### Hand Not Detected
- **Lighting**: Ensure good lighting on your hand
- **Distance**: Keep hand 1-2 feet from camera
- **Visibility**: Keep entire hand in frame
- **Status indicator**: Check "Gesture" status in control panel

### Low Performance
- **Reduce particles**: Lower particle count slider
- **Close tabs**: Close other browser tabs
- **Modern browser**: Use Chrome or Edge for best performance

### Fallback Mode
If camera doesn't work:
- **Mouse**: Vertical mouse position controls gestures
- **Spacebar**: Hold for open hand, release for closed

## 🌐 Browser Compatibility

**Recommended:**
- ✅ Google Chrome (best performance)
- ✅ Microsoft Edge
- ✅ Mozilla Firefox

**Requirements:**
- WebGL support
- Camera access
- ES6 modules
- Modern browser (2020+)

## 📝 Tips

1. **Best lighting**: Face a light source for better hand detection
2. **Steady hand**: Keep hand relatively steady for smoother effects
3. **Experiment**: Try different patterns and colors
4. **Performance**: Start with lower particle counts, then increase
5. **Fullscreen**: Use fullscreen mode for immersive experience

## 🎯 Performance Optimization

- **Lower particle count** for smoother performance
- **Close unnecessary browser tabs**
- **Use Chrome or Edge** for best WebGL performance
- **Ensure good internet** for loading MediaPipe models

Enjoy your gesture-controlled particle system! 🎉
