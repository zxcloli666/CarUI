use image::{Rgb, RgbImage};
use imageproc::drawing::{draw_filled_rect_mut, draw_text_mut};
use imageproc::rect::Rect;
use rusttype::{Font, Scale};
use chrono::{DateTime, Local};
use std::sync::OnceLock;

static FONT_DATA: &[u8] = include_bytes!("../assets/Roboto-Bold.ttf");
static FONT: OnceLock<Font<'static>> = OnceLock::new();

fn get_font() -> &'static Font<'static> {
    FONT.get_or_init(|| Font::try_from_bytes(FONT_DATA).expect("Failed to load embedded font"))
}

pub struct OverlayRenderer;

impl OverlayRenderer {
    pub fn draw(image: &mut RgbImage) {
        let width = image.width() as i32;
        let height = image.height() as i32;

        let now: DateTime<Local> = Local::now();
        let time_str = now.format("%H:%M:%S").to_string();
        let date_str = now.format("%Y-%m-%d").to_string();
        let full_text = format!("{} | {}", date_str, time_str);

        let font_size = 24.0;
        let block_w = 260;
        let block_h = 40;

        let x = width - block_w - 20;
        let y = height - block_h - 20;

        
        draw_filled_rect_mut(
            image,
            Rect::at(x, y).of_size(block_w as u32, block_h as u32),
            Rgb([0, 0, 0])
        );

        
        draw_filled_rect_mut(
            image,
            Rect::at(x + block_w - 10, y + 5).of_size(6, (block_h - 10) as u32),
            Rgb([255, 0, 0])
        );

        
        let scale = Scale { x: font_size, y: font_size };
        draw_text_mut(
            image,
            Rgb([255, 255, 255]),
            x + 10,
            y + 8,
            scale,
            get_font(),
            &full_text,
        );
    }
}