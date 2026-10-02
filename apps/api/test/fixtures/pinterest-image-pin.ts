export const sanitizedImagePinRequest = {
  boardId: "board-sanitized-123",
  title: "Sanitized integration Pin",
  description: "Sanitized fixture without personal data or credentials.",
  altText: "A neutral test illustration",
  destinationUrl: "https://example.com/sanitized",
  mediaUrl: "https://media.example.com/sanitized.jpg",
} as const;

export const sanitizedImagePinResponse = {
  id: "pin-sanitized-456",
  title: "Sanitized integration Pin",
  link: "https://example.com/sanitized",
} as const;
