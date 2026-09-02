




use gpiod::{Chip, Input, Lines, Options};

use crate::config::ReversePins;

pub struct ReverseMonitor {
    lines: Lines<Input>,
}

impl ReverseMonitor {
    pub fn new(chip_name: &str, config: &ReversePins) -> anyhow::Result<Self> {
        let chip = Chip::new(chip_name)?;

        
        
        
        
        let request = chip.request_lines(
            Options::input(&[config.signal])
                .bias(gpiod::Bias::PullDown)
                .consumer("carui-reverse"),
        )?;

        tracing::info!(
            "Reverse sensor initialized on {}: GPIO{}",
            chip_name,
            config.signal
        );

        Ok(Self { lines: request })
    }

    
    
    pub fn read_state(&self) -> bool {
        let mut values = [false; 1];
        if let Err(e) = self.lines.get_values(&mut values) {
            tracing::error!("Failed to read GPIO value: {}", e);
            return false;
        }

        
        values[0]
    }
}
