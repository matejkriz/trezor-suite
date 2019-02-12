import { addDecorator, configure } from '@storybook/react';
import { withOptions } from '@storybook/addon-options';
import { withInfo } from '@storybook/addon-info';

addDecorator(
    withOptions({
        name: 'Trezor UI',
        addonPanelInRight: true
    })
);

function loadStories() {
    require('stories/index.js');
    require('stories/components/text.js');
    require('stories/components/buttons.js');
    require('stories/components/colors.js');
    require('stories/components/form.js');
    require('stories/components/notifications.js');
    require('stories/components/loader.js');
    require('stories/components/modal.js');
    require('stories/components/icons.js');
    require('stories/components/coins.js');
}

configure(loadStories, module);
