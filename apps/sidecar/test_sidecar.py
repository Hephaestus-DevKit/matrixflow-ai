import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from config import MAX_PDF_PAGES
from parsers import parse_pdf
from text_processing import chunk_text, clean_text

class TestSidecar(unittest.TestCase):
    def test_clean_text(self):
        self.assertEqual(clean_text("hello   world"), "hello world")
        self.assertEqual(clean_text("para1\n\n\n\npara2"), "para1\n\npara2")

    def test_chunk_text_normal(self):
        text = "Hello world. This is a sentence.\n\nThis is paragraph two."
        chunks = chunk_text(text, chunk_size=100, overlap=10)
        self.assertTrue(len(chunks) >= 1)
        self.assertIn("Hello world.", chunks[0])
        self.assertIn("paragraph two.", chunks[-1])

    def test_chunk_text_long_sentence(self):
        text = "This is a very long paragraph that has multiple sentences. It should be split into smaller chunks when the size exceeds the chunk size limit of fifty. This is the third sentence to ensure split."
        chunks = chunk_text(text, chunk_size=50, overlap=10)
        self.assertTrue(len(chunks) > 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 50)

    def test_chunk_text_rejects_invalid_overlap(self):
        with self.assertRaises(ValueError):
            chunk_text("hello", chunk_size=10, overlap=10)

    @patch("parsers.PdfReader")
    def test_pdf_page_limit_preserves_413(self, reader_cls):
        reader = MagicMock()
        reader.pages = [MagicMock()] * (MAX_PDF_PAGES + 1)
        reader_cls.return_value = reader

        with self.assertRaises(HTTPException) as context:
            parse_pdf(b"not-used-by-mock")

        self.assertEqual(context.exception.status_code, 413)

if __name__ == "__main__":
    unittest.main()
