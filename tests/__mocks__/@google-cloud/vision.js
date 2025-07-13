export class ImageAnnotatorClient {
  constructor() {
    this.annotateImage = jest.fn().mockResolvedValue([
      {
        textAnnotations: [
          {
            description: "Texto de ejemplo extraído",
            confidence: 0.98,
            locale: "es",
          },
        ],
      },
    ]);
  }
}
