




use carui_common::DoorState;
use gpiod::{Chip, Input, Lines, Options};

use crate::config::DoorPins;

pub struct DoorMonitor {
    lines: Lines<Input>,
}

impl DoorMonitor {
    pub fn new(chip_name: &str, config: &DoorPins) -> anyhow::Result<Self> {
        let chip = Chip::new(chip_name)?;

        let lines = [
            config.front_left,
            config.front_right,
            config.rear_left,
            config.rear_right,
        ];

        
        
        
        
        let request = chip.request_lines(
            Options::input(&lines)
                .bias(gpiod::Bias::PullUp)
                .consumer("carui-doors"),
        )?;

        tracing::info!(
            "Door sensors initialized on {}: FL=GPIO{}, FR=GPIO{}, RL=GPIO{}, RR=GPIO{}",
            chip_name,
            config.front_left,
            config.front_right,
            config.rear_left,
            config.rear_right
        );

        Ok(Self { lines: request })
    }

    
    
    
    pub fn read_state(&self) -> DoorState {
        let mut values = [false; 4];
        if let Err(e) = self.lines.get_values(&mut values) {
            tracing::error!("Failed to read GPIO values: {}", e);
            return DoorState::default();
        }

        
        
        DoorState {
            front_left: !values[0],
            front_right: !values[1],
            rear_left: !values[2],
            rear_right: !values[3],
        }
    }
}
