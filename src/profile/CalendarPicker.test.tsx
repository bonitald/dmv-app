import { fireEvent, render, screen } from '@testing-library/react-native';
import { CalendarPicker } from './CalendarPicker';

// ph-9-us-5: the picker only allows today through 12 months ahead.
describe('CalendarPicker', () => {
  const setup = async (value = '2026-10-22') => {
    const onChange = jest.fn();
    await render(<CalendarPicker value={value} onChange={onChange} min="2026-09-24" max="2027-09-24" />);
    return onChange;
  };

  test('shows the month of the selected date, with that day selected', async () => {
    await setup();
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(screen.getByLabelText('Thursday, October 22, 2026')).toBeSelected();
  });

  test('picking an enabled day reports it', async () => {
    const onChange = await setup();
    await fireEvent.press(await screen.findByLabelText('Friday, October 30, 2026'));
    expect(onChange).toHaveBeenCalledWith('2026-10-30');
  });

  test('days before today are disabled', async () => {
    const onChange = await setup('2026-09-25');
    const yesterday = await screen.findByLabelText('Wednesday, September 23, 2026');
    expect(yesterday).toBeDisabled();
    await fireEvent.press(yesterday);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('cannot page back before the first allowed month or past the last', async () => {
    await setup('2026-09-25');
    expect(await screen.findByLabelText('Previous month')).toBeDisabled();

    for (let i = 0; i < 12; i++) await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByText('September 2027')).toBeTruthy();
    expect(screen.getByLabelText('Next month')).toBeDisabled();
    expect(screen.getByLabelText('Saturday, September 25, 2027')).toBeDisabled();
    expect(screen.getByLabelText('Friday, September 24, 2027')).toBeEnabled();
  });
});
