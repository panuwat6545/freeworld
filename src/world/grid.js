// ตารางแผนที่โลก แต่ละช่อง (cell) อาจมีจุดทรัพยากรธรรมชาติอยู่หรือไม่ก็ได้
export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        row.push({ x, y, resourceNode: null });
      }
      this.cells.push(row);
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getCell(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y][x];
  }

  forEachCell(fn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        fn(this.cells[y][x]);
      }
    }
  }
}
