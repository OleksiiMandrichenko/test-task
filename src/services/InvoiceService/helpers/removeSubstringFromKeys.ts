export default function removeSubstringFromKeys(
  obj: { [key: string]: any },
  substring: string
): { [key: string]: any } {
  const newObj: { [key: string]: any } = {};
  Object.keys(obj).forEach((key) => {
    const newKey = key.replace(substring, '');
    newObj[newKey] = obj[key];
  });
  return newObj;
}
