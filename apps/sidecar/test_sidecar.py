import unittest
from main import chunk_text, clean_text

class TestSidecar(unittest.TestCase):
    def test_clean_text(self):
        self.assertEqual(clean_text("hello   world"), "hello world")
        self.assertEqual(clean_text("para1\n\n\n\npara2"), "para1\n\npara2")

    def test_chunk_text_normal(self):
        text = "Hello world. This is a sentence.\n\nThis is paragraph two."
        chunks = chunk_text(text, chunk_size=100, overlap=10)
        self.assertTrue(len(chunks) >= 2)
        self.assertIn("Hello world.", chunks[0])
        self.assertIn("paragraph two.", chunks[-1])

    def test_chunk_text_long_sentence(self):
        text = "This is a very long paragraph that has multiple sentences. It should be split into smaller chunks when the size exceeds the chunk size limit of fifty. This is the third sentence to ensure split."
        chunks = chunk_text(text, chunk_size=50, overlap=10)
        self.assertTrue(len(chunks) > 1)
        for chunk in chunks:
            self.assertTrue(len(chunk) <= 75)  # Allow slight sentences boundary allowance

if __name__ == "__main__":
    unittest.main()
