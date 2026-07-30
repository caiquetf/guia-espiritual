module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        sand:  { 50:'#faf7f2', 100:'#f2ece1', 200:'#e3d7c3', 300:'#cfbb9c', 400:'#b89a72', 500:'#a68256', 600:'#8d6a45', 700:'#71533a', 800:'#5c4433', 900:'#4c392c', 950:'#2a1e16' },
        clay:  { 100:'#f7e9e3', 300:'#dfb3a0', 500:'#c07a5c', 700:'#8f5238', 900:'#5a3222' },
        night: { 700:'#26211c', 800:'#1d1915', 900:'#151210', 950:'#0e0c0a' }
      },
      fontFamily: {
        display: ['Georgia','"Times New Roman"','serif'],
        sans: ['Inter','system-ui','-apple-system','"Segoe UI"','Roboto','sans-serif']
      }
    }
  }
}
