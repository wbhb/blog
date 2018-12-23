class RenderLoop {
  constructor(ctx) {

    this.ctx = ctx;

    this.renderers = [];

    this.boundRender = this.render.bind(this);

    this.boundRender();
  }

  render() {

    for (const renderer of this.renderers) {
      renderer.render(this.ctx);
    }

    window.requestAnimationFrame(this.boundRender);
  }
}

class Renderer {

  constructor(ctx) {

  }

  render(ctx) {

  }
}

class Background extends Renderer {

  constructor(ctx) {
    super(ctx);

    let height = ctx.canvas.height;

    this.gradient = ctx.createLinearGradient(0, height, 0, 0);
    this.gradient.addColorStop(0, 'rgb(50, 0, 100)');
    this.gradient.addColorStop(0.1, 'rgb(50, 0, 100)');
    this.gradient.addColorStop(0.5, 'rgb(0, 0, 50)');
    this.gradient.addColorStop(1, 'rgb(15, 0, 30)');
  }

  render(ctx) {
    super.render(ctx);

    ctx.fillStyle = this.gradient;
    ctx.fillRect(0, 0, 600, 340);
  }
}

class Snowflake extends Renderer {

  constructor(ctx) {
    super(ctx);
    this.reset(ctx);
  }

  reset(ctx) {
    this.pX = Math.random() * (ctx.canvas.width + 50) - 25;
    this.pY = Math.random() * ctx.canvas.height * - 1;
    this.vX = Math.random() - 0.5;
    this.vY = Math.random() * 3 + 1;
    this.r  = Math.random() * 2 + 1;
  }

  render(ctx) {
    if (this.pY > ctx.canvas.height + 10) {
      this.reset(ctx);
    }
    this.pX += this.vX;
    this.pY += this.vY;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pX, this.pY, this.r, 0, Math.PI * 2, false);
    ctx.fill();
  }

  get color() {
    return 'rgb(255, 255, 255)';
  }
}

class Snow extends Renderer {

  constructor(ctx) {
    super(ctx);

    this.snowflakes = [];

    for (let i = 0; i < 200; i++) {
      this.snowflakes.push(new Snowflake(ctx));
    }

  }

  render(ctx) {
    super.render(ctx);
    for (let flake of this.snowflakes) {
      flake.render(ctx);
    }
  }
}

class ChristmasTree extends Renderer {

  constructor(ctx) {
    super(ctx);

    this.width = 160;
    this.height = 200;
    this.base = 20;

    this.sX = ctx.canvas.width / 1.6;
    this.sY = ctx.canvas.height;
    this.steps = 5;

    //this.color = 'rgb(60, 150, 60)';
    // this.color = 'rgb(0, 0, 0)';
    this.color = ctx.createLinearGradient(0, this.sY, 0, this.sY - this.height);
    this.color.addColorStop(0, 'sienna');
    this.color.addColorStop(this.base/this.height - 0.01, 'saddlebrown');
    this.color.addColorStop(this.base/this.height, 'darkgreen');
    const gradStep = (this.height - this.base) / this.height / this.steps;
    for (let i = 0; i < this.steps; i++) {
      this.color.addColorStop((this.base / this.height) + i * gradStep, 'darkgreen');
      this.color.addColorStop((this.base / this.height) + (i + 0.2) * gradStep, 'forestgreen');
      this.color.addColorStop((this.base / this.height) + (i + 1) * gradStep, 'darkolivegreen');
    }
  }

  render(ctx) {

    super.render(ctx);

    const sX = this.sX;
    const sY = this.sY;

    ctx.fillStyle = this.color;

    ctx.beginPath();

    ctx.moveTo(sX - (this.base / 2), sY);
    ctx.lineTo(sX - (this.base / 2), sY - this.base);

    let steps = this.steps;

    let outerStepX = this.width / 2 / steps;
    let innerStepX = outerStepX / 3;

    let stepY = (this.height - this.base) / steps;

    let easeIn = (i) => {
      let eI = i/steps;
      eI = eI * eI;
      eI *= steps;
      return eI;
    };

    for (let i = 0; i < steps; i++) {
      ctx.lineTo(sX - outerStepX * (steps - i), sY - this.base - stepY * i);
      ctx.lineTo(sX - innerStepX * (steps - easeIn(i + 1)), sY - this.base - stepY * (i + 1));
    }

    for (let i = steps - 1; i >= 0; i--) {
      ctx.lineTo(sX + innerStepX * (steps - easeIn(i + 1)), sY - this.base - stepY * (i + 1));
      ctx.lineTo(sX + outerStepX * (steps - i), sY - this.base - stepY * i);
    }

    ctx.lineTo(sX + (this.base / 2), sY - this.base);
    ctx.lineTo(sX + (this.base / 2), sY);
    ctx.closePath();

    ctx.fill();
  }
}

class Light extends Renderer {

  constructor(tree, params) {
    super(tree.ctx);
    this.color = params.color;
    this.reset(tree);
    this.frameCount = 0;
  }

  reset(tree) {

    const treeY = Math.pow(Math.random(), 1.5) * (tree.height - tree.base);
    this.pY = tree.sY - treeY - tree.base;
    const widthAtpY = ((tree.height - treeY) / tree.height) * tree.width;
    this.pX = Math.random() * widthAtpY + tree.sX - widthAtpY / 2;

    this.p = Math.random() * 120 + 60;
    this.d = Math.random() * this.p / 2 + this.p / 2;
    this.r  = Math.random() * 2 + 3;

    this.color1 = ctx.createRadialGradient(this.pX + 1, this.pY - 1, 1, this.pX, this.pY, this.r);
    this.color1.addColorStop(0, 'white');
    this.color1.addColorStop(0.2, this.color);
    this.color1.addColorStop(0.5, this.color);
    this.color1.addColorStop(1, 'grey');

    this.color2 = ctx.createRadialGradient(this.pX + 1, this.pY - 1, 1, this.pX, this.pY, this.r);
    this.color2.addColorStop(0, this.color);
    this.color2.addColorStop(0.2, this.color);
    this.color2.addColorStop(0.6, 'grey');
    this.color2.addColorStop(1, 'grey');
  }

  render(ctx) {

    if (this.frameCount < this.d) {
      ctx.fillStyle = this.color1;
    } else {
      ctx.fillStyle = this.color2;
    }

    ctx.beginPath();
    ctx.arc(this.pX, this.pY, this.r, 0, Math.PI * 2, false);
    ctx.fill();

    this.frameCount++;
    if (this.frameCount > this.p) {
      this.frameCount = 0;
    }
  }
}

class TwinklingLights extends Renderer {

  constructor(tree) {
    super(tree.ctx);

    this.lights = [];

    for (let i = 0; i < 35; i++) {
      let light = new Light(tree, {color: '#fedb00'});
      this.lights.push(light);
    }

  }

  render(ctx) {
    super.render(ctx);
    for (let light of this.lights) {
      light.render(ctx);
    }
  }
}

class CanvasImage extends Renderer {

  constructor(ctx, params) {
    super(ctx);

    this.image = new Image();
    this.image.src = params.url;
    this.pX = params.pX;
    this.pY = params.pY;
    this.width = params.width;
    this.height = params.height;
  }

  render(ctx) {
    super.render(ctx);
    ctx.drawImage(this.image, this.pX - this.width / 2, this.pY - this.height / 2, this.width, this.height);
  }
}

class CanvasText extends Renderer {

  constructor(ctx, params) {
    super(ctx);

    this.title = params.title;
    this.subtitle = params.subtitle;
    this.titleFont = params.titleFont;
    this.subtitleFont = params.subtitleFont;
    this.pX = params.pX;
    this.pY = params.pY;
    // this.width = params.width;
    // this.height = params.height;
    this.titleColor = params.titleColor;
    this.subtitleColor = params.subtitleColor;
  }

  render(ctx) {
    super.render(ctx);

    ctx.fillStyle = this.titleColor;
    ctx.font = this.titleFont;
    ctx.fillText(this.title, this.pX, this.pY + 36);

    ctx.fillStyle = this.subtitleColor;
    ctx.font = this.subtitleFont;
    ctx.fillText(this.subtitle, this.pX, this.pY + 72);
  }
}

const canvasEl = document.querySelector('canvas#card');

// if (!canvasEl.getContext) {
//   return;
// }

const ctx = canvasEl.getContext('2d');

const background = new Background(ctx);

const snow1 = new Snow(ctx);
const snow2 = new Snow(ctx);

const tree = new ChristmasTree(ctx);
const lights = new TwinklingLights(tree);
const logoTopper = new CanvasImage(ctx, {url: 'https://static.wearsblackhasbeard.com/images/logo_new.png', pY: tree.sY - tree.height, pX: tree.sX, width: 25, height: 25});

const message = new CanvasText(ctx, {title: 'Merry Christmas', subtitle: 'from Toby', titleFont: '48px "Ubuntu", sans-serif', subtitleFont: '24px "Cala Light", serif', titleColor: '#fedb00', subtitleColor: '#53565A', pX: 50, pY: 50});

const renderLoop = new RenderLoop(ctx);

renderLoop.renderers.push(background);
renderLoop.renderers.push(snow1);
renderLoop.renderers.push(tree);
renderLoop.renderers.push(lights);
renderLoop.renderers.push(logoTopper);
renderLoop.renderers.push(message);
renderLoop.renderers.push(snow2);