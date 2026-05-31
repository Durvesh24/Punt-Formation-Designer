export const getPuntDimensions = (number: number): { length: number; width: number } => {
  let lengthUnits = 12;
  switch (number) {
    case 1: lengthUnits = 14; break;
    case 2: lengthUnits = 13; break;
    case 3: lengthUnits = 14; break;
    case 4: lengthUnits = 14; break;
    case 5: lengthUnits = 14; break;
    case 6: lengthUnits = 14; break;
    case 7: lengthUnits = 14; break;
    case 8: lengthUnits = 14; break;
    case 9: lengthUnits = 12; break;
    case 10: lengthUnits = 11.5; break;
    case 11: lengthUnits = 12; break;
    case 12: lengthUnits = 11.5; break;
    case 13: lengthUnits = 12; break;
    case 14: lengthUnits = 12; break;
    case 15: lengthUnits = 13; break;
    case 16: lengthUnits = 12; break;
  }
  return {
    length: lengthUnits * 10, // 1 unit = 10 px
    width: 25, // 2.5 units = 25 px
  };
};
