// เครื่องมือกลางสำหรับนิยาม "pixel art sprite" เป็น array ของ index สี (ไม่ใช่วาดรูปทรงเรขาคณิตลอยๆ)
// sprite แต่ละตัวเขียนเป็น array ของแถว string โดยใช้ตัวอักษร 1 ตัวแทนสี 1 index (อ่าน/แก้ง่ายกว่าตัวเลขล้วน)
// แล้วแปลงเป็น grid ตัวเลขจริงผ่าน parseSprite() ครั้งเดียวตอนโหลดโมดูล — ตัว renderer (draw-sprite.js) จะ
// อ่านค่าตัวเลขจาก grid นี้เท่านั้น ไม่รู้จัก string เลย

// แปลง array ของแถว string (แต่ละตัวอักษร 1 ตัว = 1 พิกเซล) เป็น grid ตัวเลข (0 = โปร่งใสเสมอ)
// legend: { 'a': 1, 'b': 2, ... } กำหนดว่าตัวอักษรไหนแทน index สีอะไร ('.' หมายถึงโปร่งใส (0) เสมอ ไม่ต้องใส่ใน legend)
export function parseSprite(rows, legend) {
  return rows.map((row) =>
    row.split('').map((ch) => {
      if (ch === '.') return 0;
      const index = legend[ch];
      if (index === undefined) {
        throw new Error(`parseSprite: ไม่รู้จักตัวอักษร "${ch}" ในแถว "${row}" (ไม่มีใน legend)`);
      }
      return index;
    }),
  );
}

// วาด sprite 1 ตัว (grid ตัวเลขจาก parseSprite) ลงบน canvas ที่ตำแหน่ง (originX, originY) แบบ pixel-art จริง
// (แต่ละพิกเซลใน grid กลายเป็นสี่เหลี่ยมทึบขนาด pixelSize x pixelSize ไม่มี anti-alias/blur เลย)
// palette: array ของสี (index ตรงกับค่าใน grid, index 0 ไม่ใช้เพราะเป็นโปร่งใสเสมอ)
export function drawSprite(ctx, grid, palette, originX, originY, pixelSize) {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const colorIndex = line[col];
      if (colorIndex === 0) continue; // โปร่งใส ไม่วาด
      ctx.fillStyle = palette[colorIndex];
      ctx.fillRect(
        Math.round(originX + col * pixelSize),
        Math.round(originY + row * pixelSize),
        pixelSize,
        pixelSize,
      );
    }
  }
}

export function spriteWidth(grid) {
  return grid[0]?.length ?? 0;
}

export function spriteHeight(grid) {
  return grid.length;
}

// เครื่องมือช่วยเขียนแถวหนึ่งของ sprite แบบระบุ "ช่วงคอลัมน์ + ตัวอักษร" แทนการนับ/พิมพ์ตัวอักษรทีละตัว
// เอง (กันพิมพ์ผิดจำนวนตัวอักษรจนความกว้างแต่ละแถวไม่เท่ากัน) — fillChar เริ่มต้นเป็น '.' (โปร่งใส)
// ranges: array ของ [colStart, colEndInclusive, char]
export function row(width, ranges, fillChar = '.') {
  const cells = new Array(width).fill(fillChar);
  for (const [start, end, ch] of ranges) {
    for (let col = start; col <= end; col++) cells[col] = ch;
  }
  return cells.join('');
}
