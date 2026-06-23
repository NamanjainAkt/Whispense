// src/services/localParser.ts
import type { Category, ParsedExpense } from '../types';

export interface LocalParsedResult extends ParsedExpense {
  confidence: 'high' | 'low';
}

// Full Hindi numbers 0-100
const numberWords: { [key: string]: number } = {
  zero: 0, shunya: 0,
  one: 1, ek: 1,
  two: 2, do: 2,
  three: 3, teen: 3,
  four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5,
  six: 6, chhah: 6, che: 6,
  seven: 7, saat: 7,
  eight: 8, aath: 8, aat: 8,
  nine: 9, nau: 9, no: 9,
  ten: 10, das: 10, dus: 10,
  eleven: 11, gyarah: 11,
  twelve: 12, barah: 12,
  thirteen: 13, terah: 13,
  fourteen: 14, chaudah: 14, choudah: 14,
  fifteen: 15, pandrah: 15,
  sixteen: 16, solah: 16,
  seventeen: 17, satrah: 17, sattrah: 17,
  eighteen: 18, atharah: 18, atharh: 18,
  nineteen: 19, unnis: 19, unnees: 19,
  twenty: 20, bees: 20, bis: 20,
  twentyone: 21, ikkees: 21, twenty_one: 21,
  twentytwo: 22, baaees: 22, twenty_two: 22, bayi: 22,
  twentythree: 23, teyees: 23, twenty_three: 23, teis: 23,
  twentyfour: 24, chaubees: 24, twenty_four: 24,
  twentyfive: 25, pachchees: 25, twenty_five: 25, pachis: 25,
  twentysix: 26, chhabbees: 26, twenty_six: 26,
  twentyseven: 27, sattaaees: 27, twenty_seven: 27, sattais: 27,
  twentyeight: 28, atthaaees: 28, twenty_eight: 28, athais: 28,
  twentynine: 29, untees: 29, twenty_nine: 29, untis: 29,
  thirty: 30, tees: 30, tis: 30,
  thirtyone: 31, ikattees: 31, thirty_one: 31,
  thirtytwo: 32, battees: 32, thirty_two: 32,
  thirtythree: 33, taintees: 33, thirty_three: 33,
  thirtyfour: 34, chauntees: 34, thirty_four: 34,
  thirtyfive: 35, paintees: 35, thirty_five: 35,
  thirtysix: 36, chhattees: 36, thirty_six: 36,
  thirtyseven: 37, saintees: 37, thirty_seven: 37,
  thirtyeight: 38, adtees: 38, arritees: 38, thirty_eight: 38,
  thirtynine: 39, unchaalees: 39, thirty_nine: 39,
  forty: 40, chalees: 40, chalis: 40,
  fortyone: 41, ikatalees: 41, forty_one: 41,
  fortytwo: 42, bayalees: 42, forty_two: 42,
  fortythree: 43, taintaalees: 43, forty_three: 43,
  fortyfour: 44, chauralees: 44, forty_four: 44,
  fortyfive: 45, paintaalees: 45, forty_five: 45,
  fortysix: 46, chhayalees: 46, forty_six: 46,
  fortyseven: 47, saintaalees: 47, forty_seven: 47,
  fortyeight: 48, adtaalees: 48, forty_eight: 48,
  fortynine: 49, unachaas: 49, forty_nine: 49,
  fifty: 50, pachas: 50, pachaas: 50,
  fiftyone: 51, ikyawan: 51, fifty_one: 51,
  fiftytwo: 52, baawan: 52, fifty_two: 52,
  fiftythree: 53, tirepan: 53, fifty_three: 53,
  fiftyfour: 54, chauwan: 54, fifty_four: 54,
  fiftyfive: 55, pachpan: 55, fifty_five: 55,
  fiftysix: 56, chhappan: 56, fifty_six: 56,
  fiftyseven: 57, sattaavan: 57, fifty_seven: 57, satawan: 57,
  fiftyeight: 58, athaavan: 58, fifty_eight: 58, athawan: 58,
  fiftynine: 59, unsath: 59, fifty_nine: 59,
  sixty: 60, saath: 60,
  sixtyone: 61, iksath: 61, sixty_one: 61,
  sixtytwo: 62, baysath: 62, sixty_two: 62,
  sixtythree: 63, tiersath: 63, sixty_three: 63,
  sixtyfour: 64, chausath: 64, sixty_four: 64,
  sixtyfive: 65, paisaath: 65, sixty_five: 65,
  sixtysix: 66, chhiyasaath: 66, sixty_six: 66,
  sixtyseven: 67, sadsath: 67, satahsath: 67, sixty_seven: 67,
  sixtyeight: 68, adsath: 68, arhsath: 68, sixty_eight: 68,
  sixtynine: 69, unhattar: 69, sixty_nine: 69,
  seventy: 70, sattar: 70,
  seventyone: 71, ikhattar: 71, seventy_one: 71,
  seventytwo: 72, bahattar: 72, seventy_two: 72,
  seventythree: 73, tihattar: 73, seventy_three: 73,
  seventyfour: 74, chauhattar: 74, seventy_four: 74,
  seventyfive: 75, pachhattar: 75, seventy_five: 75,
  seventysix: 76, chihattar: 76, seventy_six: 76,
  seventyseven: 77, satahattar: 77, sathattar: 77, seventy_seven: 77,
  seventyeight: 78, athattar: 78, seventy_eight: 78,
  seventynine: 79, unnaasi: 79, unyasi: 79, seventy_nine: 79,
  eighty: 80, assi: 80,
  eightyone: 81, ikyasi: 81, eighty_one: 81,
  eightytwo: 82, bayasi: 82, eighty_two: 82,
  eightythree: 83, tireasi: 83, tiyasi: 83, eighty_three: 83,
  eightyfour: 84, chaurasi: 84, eighty_four: 84,
  eightyfive: 85, pachasi: 85, eighty_five: 85,
  eightysix: 86, chhiyasi: 86, eighty_six: 86,
  eightyseven: 87, sataasi: 87, satasi: 87, eighty_seven: 87,
  eightyeight: 88, athaasi: 88, athasi: 88, eighty_eight: 88,
  eightynine: 89, nawaasi: 89, eighty_nine: 89, ninyasi: 89,
  ninety: 90, nabbe: 90,
  ninetyone: 91, ikyanwe: 91, ninety_one: 91,
  ninetytwo: 92, bayanwe: 92, ninety_two: 92,
  ninetythree: 93, tiranwe: 93, tiryanwe: 93, ninety_three: 93,
  ninetyfour: 94, chauranwe: 94, ninety_four: 94,
  ninetyfive: 95, pachanwe: 95, ninety_five: 95, pachyanwe: 95,
  ninetysix: 96, chhiyanwe: 96, ninety_six: 96,
  ninetyseven: 97, sataanwe: 97, sattanwe: 97, ninety_seven: 97,
  ninetyeight: 98, athaanwe: 98, athanwe: 98, ninety_eight: 98,
  ninetynine: 99, ninyanwe: 99, ninty_nine: 99,
};

const multiplierWords: { [key: string]: number } = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  crore: 10000000,
  crores: 10000000,
  arab: 100000000,
  arabs: 100000000,
  // Hindi
  sau: 100,
  hazaar: 1000, hajar: 1000,
  karod: 10000000,
};

// Enhanced regex to catch both leading and trailing currency
// e.g. "₹50", "50₹", "50rs", "rs50", "150 rupees", "rupees 150"
const currencyPattern = /(?:rs\.?\s*|inr\s*|rupees\s*|rupee\s*|₹\s*|\$\s*|usd\s*|dollars\s*|dollar\s*|rupaye\s*|rupeya\s*)/gi;

const numRegex = /(?:rs\.?\s*|inr\s*|rupees\s*|rupee\s*|₹\s*|\$\s*|usd\s*|dollars\s*|dollar\s*|rupaye\s*|rupeya\s*)?(\d+(?:,\d+)*(?:\.\d+)?)(?:\s*(?:rs\.?|rupees|rupee|inr|rupaye|₹|\$))?/gi;

// Keywords for approximation detection
const approxKeywords = ['about', 'around', 'roughly', 'approx', 'approximately', 'nearly', 'like', 'close to', 'approximate', 'lagbhag', 'kareeb', 'takreeban'];

// Prepositions indicating item descriptions
const prepositions = [' on ', ' for ', ' to buy ', ' to purchase ', ' towards ', ' at ', ' in ', ' ka ', ' ke ', ' ki '];

// Verbs to clean up from start of items
const cleanStartVerbs = [
  'spent', 'paid', 'bought', 'gave', 'cost', 'purchased',
  'added', 'log', 'record', 'spent about', 'paid about',
  'a', 'an', 'the', 'some', 'for', 'on',
  'maine', 'usne', 'dene', 'de', 'diya', 'liya', 'kharida', 'kharch',
];

// Mapping default category names to their respective keywords
const categoryKeywords: { [key: string]: string[] } = {
  'Food & Drinks': [
    'food', 'drink', 'drinks', 'coffee', 'chai', 'tea', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger',
    'restaurant', 'cafe', 'starbucks', 'snacks', 'maggi', 'boba', 'sweets', 'swiggy', 'zomato', 'eating',
    'hotel', 'biryani', 'pub', 'bar', 'soda', 'coke', 'pepsi', 'juice', 'bakery', 'kfc', 'mcdonalds',
    'samosa', 'paratha', 'roti', 'dal', 'chawal', 'pavbhaji', 'vadapav', 'dosa', 'idli', 'noodles',
    'chaat', 'pakora', 'lassi', 'sharbat', 'nasta', 'khana', 'bhojan',
  ],
  'Transport': [
    'uber', 'ola', 'auto', 'cab', 'taxi', 'petrol', 'diesel', 'fuel', 'metro', 'bus', 'train', 'flight',
    'ticket', 'bike', 'car', 'rickshaw', 'toll', 'parking', 'transport', 'commute', 'rapido', 'fare',
    'scooty', 'cycle', 'rickshaw', 'tempo', 'travelling', 'travel', 'journey', 'safar', 'kiraya', 'bhada',
  ],
  'Groceries': [
    'groceries', 'grocery', 'milk', 'vegetables', 'fruits', 'eggs', 'bread', 'supermarket', 'mart',
    'zepto', 'blinkit', 'instamart', 'provisions', 'veggies', 'vege', 'fruit', 'oil', 'flour', 'rice',
    'salt', 'sugar', 'butter', 'cheese', 'paneer', 'doodh', 'sabji', 'sabzi', 'sabzee', 'anda',
    'atta', 'ghee', 'daal', 'masala', 'raita', 'dahi', 'curd',
  ],
  'Health': [
    'doctor', 'medicine', 'medicines', 'pharmacy', 'hospital', 'clinic', 'health', 'gym', 'workout',
    'chemist', 'medical', 'dentist', 'physio', 'therapy', 'pills', 'fitness', 'dawai', 'dava', 'ilaj',
    'checkup', 'health', 'ayurvedic', 'homeo', 'allopathy',
  ],
  'Shopping': [
    'shopping', 'shirt', 'pants', 'shoes', 'dress', 'clothes', 'clothing', 'amazon', 'flipkart',
    'myntra', 'bag', 'watch', 'tshirt', 'jeans', 'store', 'mall', 'jacket', 'sneakers', 'gift', 'gifts',
    'kapde', 'kapra', 'juta', 'joota', 'chappal', 'kharidari',
  ],
  'Bills': [
    'bill', 'rent', 'electricity', 'water', 'gas', 'wifi', 'internet', 'recharge', 'phone', 'mobile',
    'subscription', 'netflix', 'spotify', 'recharges', 'dth', 'insurance', 'ott', 'utility', 'utilities',
    'bijli', 'pani', 'gas', 'ka bill', 'bharna',
  ],
};

/**
 * Tries to parse numbers written in words from text tokens
 * Now handles Hindi number words and Hinglish mixed patterns
 */
function parseWordsToNumber(words: string[]): number | null {
  let currentVal = 0;
  let totalVal = 0;
  let foundNumber = false;

  for (const word of words) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '').toLowerCase();
    
    // Check for digit string in word (e.g. "50rupees" → the digit part)
    const digitMatch = cleanWord.match(/^(\d+)$/);
    if (digitMatch) {
      currentVal += parseInt(digitMatch[1], 10);
      foundNumber = true;
      continue;
    }
    
    if (numberWords[cleanWord] !== undefined) {
      currentVal += numberWords[cleanWord];
      foundNumber = true;
    } else if (multiplierWords[cleanWord] !== undefined) {
      const mult = multiplierWords[cleanWord];
      // If currentVal is 0 and we hit a multiplier, it's 1 * multiplier (e.g., "sau" = 100)
      currentVal = (currentVal === 0 ? 1 : currentVal) * mult;
      totalVal += currentVal;
      currentVal = 0;
      foundNumber = true;
    } else if (cleanWord === 'and' || cleanWord === 'aur') {
      // Continue parsing, e.g. "one hundred and fifty", "do sau aur pachas"
      continue;
    } else {
      // Stop at non-number word
      if (foundNumber && currentVal > 0) {
        totalVal += currentVal;
        currentVal = 0;
        // Don't break — there might be more numbers later
        // Actually break since we don't want to continue past the first number phrase
        break;
      }
    }
  }

  totalVal += currentVal;
  return foundNumber ? totalVal : null;
}

/**
 * Extracts the amount from a normalized transcript.
 * Checks for numeric digits first, then falls back to word-to-number translation.
 */
function extractAmount(text: string): { val: number; index: number; length: number } | null {
  // 1. Look for numeric patterns: e.g., "150", "1,500.50", "₹50", "50₹", "50 rs"
  let match;
  let bestMatch: { val: number; index: number; length: number } | null = null;

  // Reset regex state
  numRegex.lastIndex = 0;
  
  while ((match = numRegex.exec(text)) !== null) {
    if (!match[1]) continue;
    const rawNum = match[1].replace(/,/g, '');
    const val = parseFloat(rawNum);
    if (!isNaN(val) && val > 0) {
      bestMatch = {
        val,
        index: match.index,
        length: match[0].length,
      };
      break; // Take the first valid numeric amount found
    }
  }

  if (bestMatch) return bestMatch;

  // 2. If no numeric digits, try scanning for words (e.g. "pachas rupees", "do sau rupaye")
  const words = text.toLowerCase().split(/\s+/);
  
  // Find where the number words start and end
  let numStartIndex = -1;
  let numEndIndex = -1;
  
  for (let i = 0; i < words.length; i++) {
    const cleanWord = words[i].replace(/[^a-z0-9]/g, '');
    // Check for both Hindi number words and numeric digits  
    if (/^\d+$/.test(cleanWord) || numberWords[cleanWord] !== undefined || multiplierWords[cleanWord] !== undefined) {
      if (numStartIndex === -1) {
        numStartIndex = i;
      }
      numEndIndex = i;
    } else if (numStartIndex !== -1 && cleanWord !== 'and' && cleanWord !== 'aur') {
      // If we were parsing a number sequence and hit a non-number word that's not a connector
      // But stop before hitting verbs/prepositions that might be after the number
      break;
    }
  }

  if (numStartIndex !== -1 && numEndIndex !== -1) {
    const numberSlice = words.slice(numStartIndex, numEndIndex + 1);
    const parsedVal = parseWordsToNumber(numberSlice);
    if (parsedVal && parsedVal > 0) {
      const matchedSubstring = words.slice(0, numStartIndex).join(' ');
      const matchIndex = matchedSubstring.length ? matchedSubstring.length + 1 : 0;
      const matchedLength = words.slice(numStartIndex, numEndIndex + 1).join(' ').length;
      
      return {
        val: parsedVal,
        index: matchIndex,
        length: matchedLength,
      };
    }
  }

  return null;
}

/**
 * Normalizes item description by removing common verbs/prepositions/articles.
 */
function cleanItemName(item: string): string {
  let cleaned = item.trim().toLowerCase();
  
  // Remove leading/trailing non-alphanumeric chars
  cleaned = cleaned.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    iterations++;
    changed = false;
    for (const verb of cleanStartVerbs) {
      const regex = new RegExp(`^\\b${verb}\\b\\s*`, 'i');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '');
        changed = true;
      }
    }
  }

  // Remove trailing currency references (including Hindi)
  cleaned = cleaned.replace(/\b(?:rupees|rupee|inr|rs|dollars|dollar|usd|rupaye|rupeya|rupaiye|₹|rs\.?)\b/gi, '');
  // Remove standalone number at the end (likely the price)
  cleaned = cleaned.replace(/\s+\d+(?:\.\d+)?\s*$/, '');
  // Remove trailing currency references with numbers (e.g. "rs 50" at end)
  cleaned = cleaned.replace(/\s*(?:rs\.?|rupees|rupee|₹)\s*\d*\.?\d*\s*$/gi, '');
  
  cleaned = cleaned.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').trim();

  // Capitalize first letter of each word for neat UI
  const words = cleaned
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .slice(0, 5); // Limit to max 5 words

  if (words.length === 0) return 'Unknown';
  return words.join(' ');
}

/**
 * Processes a raw voice transcript on-device.
 * Supports Hinglish, Indian English, and pure Hindi inputs.
 * 
 * Examples:
 *   "fifty rupees chai" → ₹50 / Food & Drinks
 *   "pachas rupaye chai" → ₹50 / Food & Drinks
 *   "auto mein 120 laga" → ₹120 / Transport  
 *   "maine aaj 500 kapde kharide" → ₹500 / Shopping
 *   "uber ka 350 bhara" → ₹350 / Transport
 *   "dus rupaye ka pani" → ₹10 / Groceries (water)
 */
export function parseLocalExpense(
  transcript: string,
  categories: Category[]
): LocalParsedResult | null {
  if (!transcript || transcript.trim().length === 0) return null;

  const normalizedText = transcript.trim();
  const lowerText = normalizedText.toLowerCase();

  // 1. Extract Amount
  const amountResult = extractAmount(normalizedText);
  if (!amountResult) {
    return {
      amount: 0,
      isApproximate: false,
      item: 'Unknown',
      category: categories[0]?.name || 'Other',
      confidence: 'low',
    };
  }

  const { val: amount, index: amountIndex, length: amountLength } = amountResult;

  // 2. Detect Approximation
  const isApproximate = approxKeywords.some(keyword => lowerText.includes(keyword));

  // 3. Extract Item Description
  let item = 'Unknown';
  let hasPrepositionMatch = false;

  // Check for prepositions to identify the item boundaries
  for (const prep of prepositions) {
    const prepIndex = lowerText.indexOf(prep);
    if (prepIndex !== -1) {
      hasPrepositionMatch = true;
      
      // Determine if item is after preposition (e.g. "spent 150 on coffee")
      // or before preposition (e.g. "bought coffee for 150")
      if (prepIndex > amountIndex) {
        // Amount is before preposition: e.g., "150 on coffee", "pachas rupaye chai ke liye"
        // Item is after the preposition
        item = normalizedText.substring(prepIndex + prep.length);
      } else {
        // Preposition is before amount: e.g., "coffee for 150", "chai ka pachas"
        // Item is before the preposition
        item = normalizedText.substring(0, prepIndex);
      }
      break;
    }
  }

  // If no preposition found, do a smarter fallback extraction
  if (!hasPrepositionMatch || !item || item.trim() === 'Unknown') {
    // Strip currency references, approximation keywords from text
    let cleanedText = lowerText
      .replace(currencyPattern, ' ')
      .replace(new RegExp(approxKeywords.join('|'), 'gi'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Replace the exact matched number string
    const beforeNumber = cleanedText.substring(0, amountIndex).trim();
    const afterNumber = cleanedText.substring(amountIndex + amountLength).trim();
    
    // Check which side has cleaner item content
    const cleanedBefore = beforeNumber
      .replace(currencyPattern, '')
      .replace(/\b(?:rs\.?|rupees|rupee|inr|rupaye|₹)\s*\d*/gi, '')
      .replace(/\d+(?:\.\d+)?/g, '') // Remove any stray numbers
      .replace(/\s+/g, ' ')
      .trim();
      
    const cleanedAfter = afterNumber
      .replace(currencyPattern, '')
      .replace(/\b(?:rs\.?|rupees|rupee|inr|rupaye|₹)\s*\d*/gi, '')
      .replace(/\d+(?:\.\d+)?/g, '') // Remove any stray numbers
      .replace(/\s+/g, ' ')
      .trim();

    // Pick the shorter, more meaningful side
    if (cleanedBefore && cleanedBefore.split(/\s+/).length <= 5 && !cleanedBefore.match(/^(spent|paid|gave|maine|usne)$/)) {
      item = cleanedBefore;
    } else if (cleanedAfter && cleanedAfter.split(/\s+/).length <= 5 && !cleanedAfter.match(/^(spent|paid|gave|maine|usne)$/)) {
      item = cleanedAfter;
    } else if (cleanedBefore) {
      item = cleanedBefore;
    } else if (cleanedAfter) {
      item = cleanedAfter;
    }
  }

  const cleanedItem = cleanItemName(item) || 'Unknown';

  // 4. Match Category — with expanded Hinglish support
  let categoryName = categories[0]?.name || 'Other';
  let bestScore = 0;

  for (const cat of categories) {
    const catLower = cat.name.toLowerCase();
    
    // If the transcript explicitly mentions the category name
    if (lowerText.includes(catLower)) {
      categoryName = cat.name;
      bestScore = 100;
      break;
    }

    const keywords = categoryKeywords[cat.name] || [];
    let score = 0;
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerText) || regex.test(cleanedItem.toLowerCase())) {
        score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      categoryName = cat.name;
    }
  }

  // 5. Evaluate Confidence
  const isHighConfidence =
    amount > 0 &&
    cleanedItem !== 'Unknown' &&
    cleanedItem.length > 2 &&
    (bestScore > 0 || lowerText.includes(categoryName.toLowerCase()));

  return {
    amount,
    isApproximate,
    item: cleanedItem,
    category: categoryName,
    confidence: isHighConfidence ? 'high' : 'low',
  };
}
