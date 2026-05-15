export function shortAddress(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 1) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}
